let settings;
let mode = 'latest';
let selectedField = '';
let start = 0;
let loading = false;
let exhausted = false;
let savedPapers = {};
let randomSeen = new Set();
let semanticScholarPauseUntil = 0;

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
function currentField() { return settings.fields.find(field => field.id === selectedField) || settings.fields[0]; }
function currentQuery() { return currentField()?.query || 'cat:hep-th'; }
function apiUrl(params) { return `https://export.arxiv.org/api/query?${new URLSearchParams(params)}`; }
function arxivDate(date, end = false) {
  if (!date) return end ? '299912312359' : '199101010000';
  return date.replaceAll('-', '') + (end ? '2359' : '0000');
}
function datedQuery(query, startDate, endDate) {
  return `(${query}) AND submittedDate:[${arxivDate(startDate)} TO ${arxivDate(endDate, true)}]`;
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function retryAfterMs(response) {
  const value = response.headers.get('Retry-After');
  if (!value) return 4000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 1000), 15000);
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? Math.min(Math.max(date - Date.now(), 1000), 15000) : 4000;
}
class SemanticScholarRateLimitError extends Error {
  constructor(waitMs) {
    super('Semantic Scholarのレート制限中です。少し待ってからもう一度お試しください。');
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`arXiv HTTP ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('arXiv応答の解析に失敗しました');
  return { papers: [...doc.querySelectorAll('entry')].map(parseEntry), total: Number(text(doc, 'totalResults')) || 0 };
}
async function addCitationCounts(papers) {
  const output = papers.map(p => ({ ...p, citationCount: null }));
  for (let offset = 0; offset < output.length; offset += 100) {
    const chunk = output.slice(offset, offset + 100);
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
    if (response.status === 429) throw new SemanticScholarRateLimitError(Math.max(0, semanticScholarPauseUntil - Date.now()));
    if (!response.ok) throw new Error(`Semantic Scholar HTTP ${response.status}`);
    const data = await response.json();
    data.forEach((item, i) => { if (item && Number.isFinite(item.citationCount)) chunk[i].citationCount = item.citationCount; });
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

function renderPaper(paper, extra = {}) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.paper-card');
  const summaryEl = fragment.querySelector('.summary');
  const readMore = fragment.querySelector('.readMore');
  const save = fragment.querySelector('.save');
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
  if (Number.isFinite(paper.citationCount)) { citation.hidden = false; citation.textContent = `${paper.citationCount.toLocaleString()} citations`; }
  if (extra.classic) fragment.querySelector('.classic-badge').hidden = false;
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
    const result = await fetchPapers(apiUrl({ search_query: currentQuery(), start, max_results: settings.batchSize, sortBy: 'submittedDate', sortOrder: 'descending' }));
    if (!result.papers.length) { exhausted = true; showStatus('該当する論文がありません。'); return; }
    result.papers.forEach(p => renderPaper(p));
    start += result.papers.length; exhausted = result.papers.length < settings.batchSize;
    exhausted ? showStatus('ここまでです。') : hideStatus();
  } catch (e) { showStatus(`読み込みに失敗しました: ${e.message}`); }
  finally { loading = false; }
}

async function loadFilteredRandom(modeName) {
  if (loading || mode !== modeName) return;
  loading = true; showStatus(modeName === 'classics' ? '高被引用論文を探しています…' : '条件に合う論文をランダムに探しています…');
  try {
    const prefix = modeName === 'classics' ? 'classics' : 'random';
    const query = datedQuery(currentQuery(), settings[`${prefix}StartDate`], settings[`${prefix}EndDate`]);
    const probe = await fetchPapers(apiUrl({ search_query: query, start: 0, max_results: 1, sortBy: 'submittedDate', sortOrder: 'descending' }));
    const available = Math.min(probe.total, 30000);
    if (!available) { showStatus('期間・分野に該当する論文がありません。'); return; }
    const target = settings.batchSize;
    const accepted = [];
    const range = citationRange(modeName);
    let rateLimited = false;
    const maxAttempts = modeName === 'classics' ? 7 : 10;
    for (let attempt = 0; attempt < maxAttempts && accepted.length < target; attempt++) {
      let offset = Math.floor(Math.random() * Math.max(1, available - Math.min(50, available)));
      for (let i = 0; i < 8 && randomSeen.has(`${modeName}:${offset}`); i++) offset = Math.floor(Math.random() * Math.max(1, available - 50));
      randomSeen.add(`${modeName}:${offset}`);
      const result = await fetchPapers(apiUrl({ search_query: query, start: offset, max_results: Math.min(50, available), sortBy: 'submittedDate', sortOrder: 'descending' }));
      let enriched;
      try { enriched = await addCitationCounts(result.papers); }
      catch (error) {
        if (error instanceof SemanticScholarRateLimitError) { rateLimited = true; break; }
        if (range.min > 0 || range.max < Infinity) throw error;
        enriched = result.papers.map(p => ({ ...p, citationCount: null }));
      }
      enriched.sort(() => Math.random() - 0.5).forEach(p => {
        if (accepted.length < target && passesCitation(p, range) && !document.querySelector(`[data-id="${CSS.escape(p.id)}"]`)) accepted.push(p);
      });
    }
    accepted.forEach(p => renderPaper(p, { classic: modeName === 'classics' }));
    if (rateLimited && accepted.length) showStatus(`${accepted.length}件見つかりました。Semantic Scholarの制限中なので、少し待ってから続きを探します。`);
    else if (rateLimited) showStatus('Semantic Scholarの制限中です。少し待ってからもう一度お試しください。');
    else if (!accepted.length) showStatus('条件に合う論文を見つけられませんでした。期間または引用数を緩めてください。');
    else if (accepted.length < target) showStatus(`${accepted.length}件見つかりました。さらに読み込むと別の候補を探します。`);
    else hideStatus();
  } catch (e) { showStatus(`読み込みに失敗しました: ${e.message}`); }
  finally { loading = false; }
}

function showSaved() {
  const papers = Object.values(savedPapers).sort((a, b) => new Date(b.published) - new Date(a.published));
  if (!papers.length) showStatus('保存した論文はまだありません。');
  else { hideStatus(); papers.forEach(p => renderPaper(p)); }
}
function updateIntro() {
  modeIntro.hidden = false;
  if (mode === 'random') modeIntro.textContent = `期間・引用数の条件に合う「${currentField().label}」の論文をランダムに流します。条件は設定画面で変更できます。`;
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
fieldSelect.addEventListener('change', () => { selectedField = fieldSelect.value; randomSeen.clear(); reloadMode(); });
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
  await loadSaved(); reloadMode();
})();
