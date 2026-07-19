let settings;
let mode = 'latest';
let selectedField = '';
let explorationQuery = '';
let explorationLabel = '';
let start = 0;
let loading = false;
let exhausted = false;
let savedPapers = {};
let paperReactions = {};
let randomSeen = new Set();
let semanticScholarPauseUntil = 0;
let inspirePauseUntil = 0;
const CITATION_CACHE_KEY = 'citationCounts';
const CITATION_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MISSING_CITATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const feed = document.querySelector('#feed');
const status = document.querySelector('#status');
const template = document.querySelector('#paperTemplate');
const sentinel = document.querySelector('#sentinel');
const fieldSelect = document.querySelector('#fieldSelect');
const shuffleButton = document.querySelector('#shuffleButton');
const modeIntro = document.querySelector('#modeIntro');

function text(node, selector) { return node.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() || ''; }
function baseArxivId(value) { return String(value || '').split('/abs/').pop().replace(/v\d+$/i, ''); }
function entryId(entry) { return baseArxivId(text(entry, 'id')); }
function formatDate(value) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return '今日';
  if (days === 1) return '昨日';
  if (days > 1 && days < 7) return `${days}日前`;
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}
function paperAgeDays(paper) { return Math.floor((Date.now() - new Date(paper.published).getTime()) / 86400000); }
function currentField() { return settings.fields.find(field => field.id === selectedField) || settings.fields[0]; }
function arxivQuoted(value) { return String(value || '').replaceAll('"', ' ').replace(/\s+/g, ' ').trim(); }
function currentQuery() {
  const query = currentField()?.query || 'cat:hep-th';
  const author = arxivQuoted(settings.authorFilter);
  return author ? `(${query}) AND au:"${author}"` : query;
}
function activeQuery() { return explorationQuery || currentQuery(); }
function apiUrl(params) { return `https://export.arxiv.org/api/query?${new URLSearchParams(params)}`; }
function arxivDate(date, end = false) {
  if (!date) return end ? '299912312359' : '199101010000';
  return date.replaceAll('-', '') + (end ? '2359' : '0000');
}
function datedQuery(query, startDate, endDate) {
  return `(${query}) AND submittedDate:[${arxivDate(startDate)} TO ${arxivDate(endDate, true)}]`;
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function isRetryableArxivStatus(status) { return [500, 502, 503, 504].includes(status); }
function retryAfterMs(response) {
  const value = response.headers.get('Retry-After');
  if (!value) return 4000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 1000), 15000);
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? Math.min(Math.max(date - Date.now(), 1000), 15000) : 4000;
}
class CitationRateLimitError extends Error {
  constructor(waitMs) {
    super('引用数APIのレート制限中です。少し待ってからもう一度お試しください。');
    this.waitMs = waitMs;
  }
}
function parseEntry(entry) {
  const id = entryId(entry);
  return {
    id,
    title: text(entry, 'title'),
    summary: text(entry, 'summary'),
    authors: [...entry.querySelectorAll('author > name')].map(n => n.textContent.trim()),
    categories: [...entry.querySelectorAll('category')].map(c => c.getAttribute('term')).filter(Boolean),
    published: text(entry, 'published'),
    abstractUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`
  };
}
async function fetchPapers(url) {
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url);
    if (!isRetryableArxivStatus(response.status)) break;
    if (attempt < 2) await sleep(1200 * (attempt + 1));
  }
  if (!response.ok) throw new Error(`arXiv HTTP ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('arXiv応答の解析に失敗しました');
  return { papers: [...doc.querySelectorAll('entry')].map(parseEntry), total: Number(text(doc, 'totalResults')) || 0 };
}
async function loadCitationCache() {
  return (await chrome.storage.local.get({ [CITATION_CACHE_KEY]: {} }))[CITATION_CACHE_KEY];
}
async function persistCitationCache(cache) {
  await chrome.storage.local.set({ [CITATION_CACHE_KEY]: cache });
}
function cachedCitationCount(record, now = Date.now()) {
  if (!record || !Number.isFinite(record.fetchedAt)) return undefined;
  const ttl = Number.isFinite(record.citationCount) ? CITATION_CACHE_TTL : MISSING_CITATION_CACHE_TTL;
  return now - record.fetchedAt <= ttl ? record.citationCount : undefined;
}
function cachedCitationSource(record, now = Date.now()) {
  return cachedCitationCount(record, now) === undefined ? '' : record.citationSource || '';
}
function citationMode() { return settings.citationSourceMode || 'auto'; }
function citationCacheId(paper) { return `${citationMode()}:${paper.id}`; }
function usesSemanticScholar() { return ['auto', 'semantic'].includes(citationMode()); }
function usesInspire() { return ['auto', 'inspire'].includes(citationMode()); }
function isHepPaper(paper) {
  return (paper.categories || []).some(category => /^hep-/.test(category));
}
function mergeCitation(paper, citationCount, citationSource) {
  if (!Number.isFinite(citationCount)) return false;
  if (!Number.isFinite(paper.citationCount) || citationCount > paper.citationCount) {
    paper.citationCount = citationCount;
    paper.citationSource = citationSource;
    return true;
  }
  return false;
}
async function fetchInspireCitationCount(paper) {
  const waitMs = Math.max(0, inspirePauseUntil - Date.now());
  if (waitMs) await sleep(waitMs);
  const response = await fetch(`https://inspirehep.net/api/arxiv/${encodeURIComponent(paper.id)}`);
  if (response.status === 404) return null;
  if (response.status === 429) {
    const wait = retryAfterMs(response);
    inspirePauseUntil = Date.now() + Math.max(wait, 5000);
    throw new CitationRateLimitError(wait);
  }
  if (!response.ok) return null;
  const data = await response.json();
  const citationCount = data?.metadata?.citation_count;
  inspirePauseUntil = Date.now() + 400;
  return Number.isFinite(citationCount) ? citationCount : null;
}
async function addCitationCounts(papers, options = {}) {
  const chunkSize = options.chunkSize || 100;
  const cache = await loadCitationCache();
  const now = Date.now();
  const output = papers.map(p => ({ ...p, citationCount: null }));
  const missing = [];
  output.forEach(paper => {
    const cached = cachedCitationCount(cache[citationCacheId(paper)], now);
    if (cached === undefined) missing.push(paper);
    else { paper.citationCount = cached; paper.citationSource = cachedCitationSource(cache[citationCacheId(paper)], now); }
  });
  let cacheChanged = false;
  try {
    for (let offset = 0; usesSemanticScholar() && offset < missing.length; offset += chunkSize) {
      const chunk = missing.slice(offset, offset + chunkSize);
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        const waitMs = Math.max(0, semanticScholarPauseUntil - Date.now());
        if (waitMs) await sleep(waitMs);
        response = await fetch('https://api.semanticscholar.org/graph/v1/paper/batch?fields=externalIds,citationCount', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk.map(p => `ARXIV:${p.id}`) })
        });
        if (response.status !== 429) break;
        const wait = retryAfterMs(response);
        semanticScholarPauseUntil = Date.now() + wait;
        if (attempt === 0) await sleep(wait);
      }
      if (response.status === 429) throw new CitationRateLimitError(Math.max(0, semanticScholarPauseUntil - Date.now()));
      if (!response.ok) throw new Error(`Semantic Scholar HTTP ${response.status}`);
      const data = await response.json();
      data.forEach((item, i) => {
        const citationCount = item && Number.isFinite(item.citationCount) ? item.citationCount : null;
        chunk[i].citationCount = citationCount;
        chunk[i].citationSource = Number.isFinite(citationCount) ? 'Semantic Scholar' : '';
        cache[citationCacheId(chunk[i])] = { citationCount, citationSource: chunk[i].citationSource, fetchedAt: Date.now() };
        cacheChanged = true;
      });
    }
    const inspireCandidates = usesInspire() ? output.filter(isHepPaper).slice(0, options.inspireLimit || 8) : [];
    for (const paper of inspireCandidates) {
      try {
        const citationCount = await fetchInspireCitationCount(paper);
        if (mergeCitation(paper, citationCount, 'INSPIRE')) {
          cache[citationCacheId(paper)] = { citationCount: paper.citationCount, citationSource: paper.citationSource, fetchedAt: Date.now() };
          cacheChanged = true;
        }
      } catch (error) {
        if (error instanceof CitationRateLimitError) break;
      }
    }
  } finally {
    if (cacheChanged) await persistCitationCache(cache);
  }
  return output;
}
function citationRange(modeName) {
  const prefix = modeName === 'classics' ? 'classics' : 'random';
  const min = Number(settings[`${prefix}MinCitations`] || 0);
  const rawMax = settings[`${prefix}MaxCitations`];
  return { min, max: rawMax === '' || rawMax == null ? Infinity : Number(rawMax) };
}
function passesCitation(paper, range) {
  const allowsUnknownCitations = range.min === 0 && range.max === Infinity;
  if (!Number.isFinite(paper.citationCount)) return allowsUnknownCitations;
  return paper.citationCount >= range.min && paper.citationCount <= range.max;
}
async function loadSaved() { savedPapers = (await chrome.storage.local.get({ savedPapers: {} })).savedPapers; }
async function persistSaved() { await chrome.storage.local.set({ savedPapers }); }
async function loadReactions() { paperReactions = (await chrome.storage.local.get({ paperReactions: {} })).paperReactions; }
async function persistReactions() { await chrome.storage.local.set({ paperReactions }); }
function reactionFor(paper) { return paperReactions[paper.id]?.reaction || ''; }
function isSkipped(paper) { return reactionFor(paper) === 'skip'; }
function visiblePapers(papers) { return papers.filter(paper => !isSkipped(paper)); }
function reactionAffinity(paper, options = {}) {
  const categories = new Set(options.includeCategories ? paper.categories || [] : []);
  const authors = new Set(paper.authors || []);
  return Object.values(paperReactions).reduce((score, record) => {
    if (!['interest', 'read'].includes(record.reaction)) return score;
    const weight = record.reaction === 'interest' ? 3 : 1;
    const reactedPaper = record.paper || {};
    const categoryHit = options.includeCategories && (reactedPaper.categories || []).some(category => categories.has(category));
    const authorHit = (reactedPaper.authors || []).some(author => authors.has(author));
    return score + (categoryHit ? weight : 0) + (authorHit ? weight * 2 : 0);
  }, 0);
}
function rankForTimeline(papers, modeName) {
  if (modeName === 'random') return papers.sort(() => Math.random() - 0.5);
  return papers.sort((a, b) => {
    const affinity = reactionAffinity(b, { includeCategories: true }) - reactionAffinity(a, { includeCategories: true });
    if (affinity) return affinity;
    if (modeName === 'classics') return (b.citationCount ?? -1) - (a.citationCount ?? -1);
    if (modeName === 'latest') return new Date(b.published) - new Date(a.published);
    return Math.random() - 0.5;
  });
}
function labelReaction(button, activeLabel, inactiveLabel, active) {
  button.classList.toggle('active', active);
  button.textContent = active ? activeLabel : inactiveLabel;
}
async function setReaction(paper, reaction, card) {
  const current = reactionFor(paper);
  if (current === reaction) delete paperReactions[paper.id];
  else paperReactions[paper.id] = {
    reaction,
    updatedAt: Date.now(),
    paper: { id: paper.id, title: paper.title, published: paper.published, categories: paper.categories, authors: paper.authors }
  };
  await persistReactions();
  if (reactionFor(paper) === 'skip') {
    card.remove();
    if (mode === 'saved' && !feed.children.length) showStatus('保存した論文はまだありません。');
    return;
  }
  updateReactionButtons(card, paper);
}
function updateReactionButtons(card, paper) {
  const reaction = reactionFor(paper);
  labelReaction(card.querySelector('.interest'), '気になる済み', '気になる', reaction === 'interest');
  labelReaction(card.querySelector('.read'), '読了済み', '読んだ', reaction === 'read');
  labelReaction(card.querySelector('.skip'), 'スキップ済み', 'スキップ', reaction === 'skip');
}
function discoveryBadges(paper, extra = {}) {
  const badges = [];
  const ageDays = paperAgeDays(paper);
  if (extra.classic || (Number.isFinite(paper.citationCount) && paper.citationCount >= Number(settings.classicsMinCitations || 0))) badges.push('高引用');
  if (ageDays >= 0 && ageDays <= 7) badges.push('新着');
  if (reactionAffinity(paper) > 0) badges.push('関心に近い');
  if (savedPapers[paper.id]) badges.push('保存済み');
  return badges.slice(0, 3);
}
function renderDiscoveryBadges(card, paper, extra = {}) {
  const container = card.querySelector('.discovery-badges');
  const badges = discoveryBadges(paper, extra);
  container.replaceChildren();
  container.hidden = !badges.length;
  badges.forEach(label => {
    const badge = document.createElement('span');
    badge.className = 'discovery-badge';
    badge.textContent = label;
    container.appendChild(badge);
  });
}
function explore(query, label) {
  explorationQuery = query;
  explorationLabel = label;
  mode = 'latest';
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  reloadMode();
}

function renderPaper(paper, extra = {}) {
  if (isSkipped(paper)) return;
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.paper-card');
  const summaryEl = fragment.querySelector('.summary');
  const readMore = fragment.querySelector('.readMore');
  const save = fragment.querySelector('.save');
  const sameAuthor = fragment.querySelector('.same-author');
  const sameField = fragment.querySelector('.same-field');
  card.dataset.id = paper.id;
  fragment.querySelector('.primary-category').textContent = paper.categories[0] || 'arXiv';
  fragment.querySelector('.date').textContent = formatDate(paper.published);
  fragment.querySelector('.title').textContent = paper.title;
  fragment.querySelector('.authors').textContent = paper.authors.join(', ');
  summaryEl.textContent = paper.summary;
  fragment.querySelector('.abstract').href = `https://arxiv.org/abs/${baseArxivId(paper.id)}`;
  fragment.querySelector('.pdf').href = `https://arxiv.org/pdf/${baseArxivId(paper.id)}`;
  save.textContent = savedPapers[paper.id] ? '保存済み ★' : '保存';
  const citation = fragment.querySelector('.citation-count');
  if (Number.isFinite(paper.citationCount)) {
    citation.hidden = false;
    citation.textContent = `${paper.citationCount.toLocaleString()} citations${paper.citationSource ? ` · ${paper.citationSource}` : ''}`;
  }
  if (extra.classic) fragment.querySelector('.classic-badge').hidden = false;
  renderDiscoveryBadges(card, paper, extra);
  updateReactionButtons(card, paper);
  fragment.querySelector('.interest').addEventListener('click', () => setReaction(paper, 'interest', card));
  fragment.querySelector('.read').addEventListener('click', () => setReaction(paper, 'read', card));
  fragment.querySelector('.skip').addEventListener('click', () => setReaction(paper, 'skip', card));
  sameAuthor.hidden = !paper.authors[0];
  sameAuthor.addEventListener('click', () => explore(`au:"${arxivQuoted(paper.authors[0])}"`, `著者 ${paper.authors[0]}`));
  sameField.hidden = !paper.categories[0];
  sameField.addEventListener('click', () => explore(`cat:${paper.categories[0]}`, `分野 ${paper.categories[0]}`));
  readMore.addEventListener('click', () => {
    const collapsed = summaryEl.classList.toggle('collapsed');
    readMore.textContent = collapsed ? '全文' : '折りたたむ';
  });
  save.addEventListener('click', async () => {
    if (savedPapers[paper.id]) { delete savedPapers[paper.id]; save.textContent = '保存'; if (mode === 'saved') card.remove(); }
    else { savedPapers[paper.id] = paper; save.textContent = '保存済み ★'; }
    await persistSaved();
    if (mode === 'saved' && !feed.children.length) showStatus('保存した論文はまだありません。');
  });
  feed.appendChild(fragment);
}
function showStatus(message) { status.hidden = false; status.textContent = message; }
function hideStatus() { status.hidden = true; }

async function loadLatest() {
  if (loading || exhausted || mode !== 'latest') return;
  loading = true; showStatus(start ? 'さらに読み込み中…' : '新着を読み込み中…');
  try {
    const result = await fetchPapers(apiUrl({ search_query: activeQuery(), start, max_results: settings.batchSize, sortBy: 'submittedDate', sortOrder: 'descending' }));
    if (!result.papers.length) { exhausted = true; showStatus('該当する論文がありません。'); return; }
    rankForTimeline(visiblePapers(result.papers), 'latest').forEach(p => renderPaper(p));
    start += result.papers.length; exhausted = result.papers.length < settings.batchSize;
    exhausted ? showStatus('ここまでです。') : hideStatus();
  } catch (e) { showStatus(e.message.startsWith('arXiv HTTP 5') ? 'arXivが一時的に不安定です。少し待ってから更新してください。' : `読み込みに失敗しました: ${e.message}`); }
  finally { loading = false; }
}

async function loadFilteredRandom(modeName) {
  if (loading || mode !== modeName) return;
  loading = true; showStatus(modeName === 'classics' ? '高被引用論文を探しています…' : '条件に合う論文をランダムに探しています…');
  try {
    const prefix = modeName === 'classics' ? 'classics' : 'random';
    const query = datedQuery(activeQuery(), settings[`${prefix}StartDate`], settings[`${prefix}EndDate`]);
    const probe = await fetchPapers(apiUrl({ search_query: query, start: 0, max_results: 1, sortBy: 'submittedDate', sortOrder: 'descending' }));
    const available = Math.min(probe.total, 30000);
    if (!available) { showStatus('期間・分野に該当する論文がありません。'); return; }
    const target = modeName === 'classics' ? Math.min(settings.batchSize, 10) : settings.batchSize;
    const accepted = [];
    const range = citationRange(modeName);
    let rateLimited = false;
    const maxAttempts = modeName === 'classics' ? 4 : 10;
    const pageSize = modeName === 'classics' ? 25 : 50;
    for (let attempt = 0; attempt < maxAttempts && accepted.length < target; attempt++) {
      let offset = Math.floor(Math.random() * Math.max(1, available - Math.min(pageSize, available)));
      for (let i = 0; i < 8 && randomSeen.has(`${modeName}:${offset}`); i++) offset = Math.floor(Math.random() * Math.max(1, available - pageSize));
      randomSeen.add(`${modeName}:${offset}`);
      const result = await fetchPapers(apiUrl({ search_query: query, start: offset, max_results: Math.min(pageSize, available), sortBy: 'submittedDate', sortOrder: 'descending' }));
      let enriched;
      try { enriched = await addCitationCounts(result.papers, { chunkSize: pageSize, inspireLimit: modeName === 'classics' ? 12 : 6 }); }
      catch (error) {
        if (error instanceof CitationRateLimitError) { rateLimited = true; break; }
        if (range.min > 0 || range.max < Infinity) throw error;
        enriched = result.papers.map(p => ({ ...p, citationCount: null }));
      }
      rankForTimeline(enriched, modeName).forEach(p => {
        if (accepted.length < target && !isSkipped(p) && passesCitation(p, range) && !document.querySelector(`[data-id="${CSS.escape(p.id)}"]`)) accepted.push(p);
      });
    }
    accepted.forEach(p => renderPaper(p, { classic: modeName === 'classics' }));
    if (rateLimited && accepted.length) showStatus(`${accepted.length}件見つかりました。Semantic Scholarの制限中なので、少し待ってから続きを探します。`);
    else if (rateLimited) showStatus('Semantic Scholarの制限中です。少し待ってからもう一度お試しください。');
    else if (!accepted.length) showStatus('条件に合う論文を見つけられませんでした。期間または引用数を緩めてください。');
    else if (accepted.length < target) showStatus(`${accepted.length}件見つかりました。さらに読み込むと別の候補を探します。`);
    else hideStatus();
  } catch (e) { showStatus(e.message.startsWith('arXiv HTTP 5') ? 'arXivが一時的に不安定です。少し待ってからもう一度お試しください。' : `読み込みに失敗しました: ${e.message}`); }
  finally { loading = false; }
}

function showSaved() {
  const papers = visiblePapers(Object.values(savedPapers)).sort((a, b) => new Date(b.published) - new Date(a.published));
  if (!papers.length) showStatus('保存した論文はまだありません。');
  else { hideStatus(); papers.forEach(p => renderPaper(p)); }
}
function updateIntro() {
  modeIntro.hidden = false;
  if (explorationQuery) modeIntro.textContent = `「${explorationLabel}」を探索中です。分野を選び直すと通常のタイムラインに戻ります。`;
  else if (mode === 'random') modeIntro.textContent = `期間・引用数の条件に合う「${currentField().label}」の論文をランダムに流します。条件は設定画面で変更できます。`;
  else if (mode === 'classics') modeIntro.textContent = `固定リストではなく、「${currentField().label}」の論文を引用数でその都度選別して流します。`;
  else modeIntro.hidden = true;
}
function reloadMode() {
  feed.replaceChildren(); start = 0; exhausted = false; updateIntro();
  shuffleButton.hidden = !['random', 'classics'].includes(mode);
  fieldSelect.disabled = mode === 'saved';
  if (mode === 'latest') loadLatest();
  else if (mode === 'random') loadFilteredRandom('random');
  else if (mode === 'classics') loadFilteredRandom('classics');
  else showSaved();
}
function switchMode(next) {
  mode = next;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  reloadMode();
}
function populateFields() {
  fieldSelect.replaceChildren();
  settings.fields.forEach(field => {
    const option = document.createElement('option'); option.value = field.id; option.textContent = field.label; fieldSelect.appendChild(option);
  });
}
fieldSelect.addEventListener('change', () => { selectedField = fieldSelect.value; explorationQuery = ''; explorationLabel = ''; randomSeen.clear(); reloadMode(); });
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchMode(tab.dataset.mode)));
shuffleButton.addEventListener('click', () => { feed.replaceChildren(); randomSeen.clear(); reloadMode(); });
document.querySelector('#refreshButton').addEventListener('click', reloadMode);
document.querySelector('#optionsButton').addEventListener('click', () => chrome.runtime.openOptionsPage());
new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  if (mode === 'latest') loadLatest();
  if (['random', 'classics'].includes(mode) && feed.children.length) loadFilteredRandom(mode);
}, { rootMargin: '500px' }).observe(sentinel);

(async () => {
  settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (!Array.isArray(settings.fields) || !settings.fields.length) settings.fields = BUILTIN_FIELDS;
  populateFields();
  selectedField = settings.fields.some(f => f.id === settings.defaultField) ? settings.defaultField : settings.fields[0].id;
  fieldSelect.value = selectedField;
  await loadSaved(); await loadReactions(); reloadMode();
})();
