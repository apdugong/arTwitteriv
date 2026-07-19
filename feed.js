let settings;
let mode = 'latest';
let selectedField = '';
let explorationQuery = '';
let explorationLabel = '';
let searchText = '';
let classicsSearchText = '';
let selectedClassicsEra = 'settings';
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
const fieldControl = document.querySelector('#fieldControl');
const searchForm = document.querySelector('#searchForm');
const searchInput = document.querySelector('#searchInput');
const classicsSearchForm = document.querySelector('#classicsSearchForm');
const classicsSearchInput = document.querySelector('#classicsSearchInput');
const shuffleButton = document.querySelector('#shuffleButton');
const classicsEraTabs = document.querySelector('#classicsEraTabs');
const modeIntro = document.querySelector('#modeIntro');
const CLASSICS_ERAS = [
  { id: 'settings', labelKey: 'classicsEraSettings' },
  { id: '1970_1979', label: '1970-1979', start: '1970-01-01', end: '1979-12-31', preArxiv: true },
  { id: '1980_1989', label: '1980-1989', start: '1980-01-01', end: '1989-12-31', preArxiv: true },
  { id: '1990_1994', label: '1990-1994', start: '1990-01-01', end: '1994-12-31' },
  { id: '1995_1999', label: '1995-1999', start: '1995-01-01', end: '1999-12-31' },
  { id: '2000_2004', label: '2000-2004', start: '2000-01-01', end: '2004-12-31' },
  { id: '2005_2009', label: '2005-2009', start: '2005-01-01', end: '2009-12-31' },
  { id: '2010_2014', label: '2010-2014', start: '2010-01-01', end: '2014-12-31' },
  { id: '2015_2019', label: '2015-2019', start: '2015-01-01', end: '2019-12-31' },
  { id: '2020_now', labelKey: 'classicsEra2020Now', start: '2020-01-01', end: '' }
];
const PRE_ARXIV_SUBJECT_BY_CATEGORY = {
  'hep-th': 'Theory-HEP',
  'hep-ph': 'Phenomenology-HEP',
  'hep-ex': 'Experiment-HEP',
  'hep-lat': 'Lattice'
};

function text(node, selector) { return node.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() || ''; }
function baseArxivId(value) { return String(value || '').split('/abs/').pop().replace(/v\d+$/i, ''); }
function entryId(entry) { return baseArxivId(text(entry, 'id')); }
function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return i18n('unknownDate');
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return i18n('today');
  if (days === 1) return i18n('yesterday');
  if (days > 1 && days < 7) return i18n('daysAgo', days);
  return new Intl.DateTimeFormat(i18nLocale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}
function paperAgeDays(paper) {
  const published = new Date(paper.published).getTime();
  return Number.isFinite(published) ? Math.floor((Date.now() - published) / 86400000) : Infinity;
}
function currentField() { return settings.fields.find(field => field.id === selectedField) || settings.fields[0]; }
function arxivQuoted(value) { return String(value || '').replaceAll('"', ' ').replace(/\s+/g, ' ').trim(); }
function currentQuery() {
  const query = currentField()?.query || 'cat:hep-th';
  const author = arxivQuoted(settings.authorFilter);
  return author ? `(${query}) AND au:"${author}"` : query;
}
function activeQuery() { return explorationQuery || currentQuery(); }
function looksLikeArxivQuery(value) {
  return /\b(?:all|ti|au|abs|cat|id|jr|rn|co):/i.test(value) || /\b(?:AND|OR|ANDNOT)\b/.test(value) || /[()]/.test(value);
}
function tokenizeSearch(value) {
  return String(value || '').match(/"[^"]+"|\S+/g) || [];
}
function searchInputQuery(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (looksLikeArxivQuery(raw)) return raw;
  return tokenizeSearch(raw)
    .map(term => arxivQuoted(term.replace(/^"|"$/g, '')))
    .filter(Boolean)
    .map(term => term.includes(' ') ? `all:"${term}"` : `all:${term}`)
    .join(' AND ');
}
function classicsQuery() {
  const filter = searchInputQuery(classicsSearchText);
  return filter ? `(${activeQuery()}) AND (${filter})` : activeQuery();
}
function apiUrl(params) { return `https://export.arxiv.org/api/query?${new URLSearchParams(params)}`; }
function arxivDate(date, end = false) {
  if (!date) return end ? '299912312359' : '199101010000';
  return date.replaceAll('-', '') + (end ? '2359' : '0000');
}
function datedQuery(query, startDate, endDate) {
  return `(${query}) AND submittedDate:[${arxivDate(startDate)} TO ${arxivDate(endDate, true)}]`;
}
function currentClassicsEra() {
  return CLASSICS_ERAS.find(era => era.id === selectedClassicsEra) || CLASSICS_ERAS[0];
}
function normalizeClassicsEraId(value) {
  const id = value === '1991_1999' ? '1995_1999' : value;
  return CLASSICS_ERAS.some(era => era.id === id) ? id : 'settings';
}
function classicsUsesPreArxivSubject() {
  const era = currentClassicsEra();
  return era.preArxiv || (era.start && era.start < '1991-01-01');
}
function classicsEraLabel(era = currentClassicsEra()) {
  return era.labelKey ? i18n(era.labelKey) : era.label;
}
function classicsDateRange() {
  const era = currentClassicsEra();
  if (era.start) return { startDate: era.start, endDate: era.end };
  return { startDate: settings.classicsStartDate, endDate: settings.classicsEndDate };
}
function timelineDateRange(modeName) {
  if (modeName === 'classics') return classicsDateRange();
  return { startDate: settings.randomStartDate, endDate: settings.randomEndDate };
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
    super(i18n('citationApiRateLimit'));
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
function inspireCategoryQuery(category, options = {}) {
  if (options.preArxivSubject && PRE_ARXIV_SUBJECT_BY_CATEGORY[category]) return `subject:${PRE_ARXIV_SUBJECT_BY_CATEGORY[category]}`;
  return `arxiv_eprints.categories:${category}`;
}
function inspireTextQuery(query, options = {}) {
  return String(query || '')
    .replace(/\bcat:([A-Za-z0-9.-]+)/g, (_, category) => inspireCategoryQuery(category, options))
    .replace(/\ball:"([^"]+)"/g, '"$1"')
    .replace(/\ball:([^\s()]+)/g, '$1')
    .replace(/\bau:"([^"]+)"/g, 'a $1')
    .replace(/\bau:([^\s()]+)/g, 'a $1')
    .replace(/\bAND\b/g, 'and')
    .replace(/\bOR\b/g, 'or');
}
function inspireDateQuery(startDate, endDate) {
  if (startDate && endDate) return `de ${startDate}->${endDate}`;
  if (startDate) return `de > ${startDate}`;
  if (endDate) return `de < ${endDate}`;
  return '';
}
function inspireCitationQuery(range) {
  if (range.min > 0 && range.max < Infinity) return `cited:${range.min}->${range.max}`;
  if (range.min > 0) return `topcite ${range.min}+`;
  if (range.max < Infinity) return `cited:0->${range.max}`;
  return '';
}
function inspireClassicsQuery() {
  const range = citationRange('classics');
  const dates = classicsDateRange();
  return [
    inspireTextQuery(classicsQuery(), { preArxivSubject: classicsUsesPreArxivSubject() }),
    inspireDateQuery(dates.startDate, dates.endDate),
    inspireCitationQuery(range)
  ].filter(Boolean).join(' and ');
}
function inspireSearchUrl(params) {
  return `https://inspirehep.net/api/literature?${new URLSearchParams(params)}`;
}
function inspireTotal(result) {
  const total = result?.hits?.total;
  return typeof total === 'number' ? total : Number(total?.value || 0);
}
function parseInspirePaper(hit) {
  const metadata = hit.metadata || {};
  const arxiv = (metadata.arxiv_eprints || []).find(item => item.value);
  const controlNumber = metadata.control_number || hit.id;
  if (!arxiv?.value && !controlNumber) return null;
  const citationCount = Number(metadata.citation_count);
  const arxivId = arxiv?.value ? baseArxivId(arxiv.value) : '';
  const inspireCategories = (metadata.inspire_categories || []).map(category => category.term).filter(Boolean);
  return {
    id: arxivId || `inspire:${controlNumber}`,
    title: metadata.titles?.find(item => item.title)?.title || 'Untitled',
    summary: metadata.abstracts?.find(item => item.value)?.value || '',
    authors: (metadata.authors || []).map(author => author.full_name).filter(Boolean),
    categories: arxiv?.categories?.length ? arxiv.categories : inspireCategories,
    published: metadata.earliest_date || '',
    abstractUrl: arxivId ? `https://arxiv.org/abs/${arxivId}` : `https://inspirehep.net/literature/${controlNumber}`,
    abstractLabel: arxivId ? 'arXiv' : 'INSPIRE',
    pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : '',
    citationCount: Number.isFinite(citationCount) ? citationCount : null,
    citationSource: Number.isFinite(citationCount) ? 'INSPIRE' : ''
  };
}
async function fetchInspireSearch(query, page, size) {
  const waitMs = Math.max(0, inspirePauseUntil - Date.now());
  if (waitMs) await sleep(waitMs);
  const response = await fetch(inspireSearchUrl({
    q: query,
    sort: 'mostcited',
    page,
    size,
    fields: 'titles,abstracts,authors.full_name,arxiv_eprints,inspire_categories,citation_count,earliest_date,control_number'
  }));
  if (response.status === 429) {
    const wait = retryAfterMs(response);
    inspirePauseUntil = Date.now() + Math.max(wait, 5000);
    throw new CitationRateLimitError(wait);
  }
  if (!response.ok) throw new Error(`INSPIRE HTTP ${response.status}`);
  inspirePauseUntil = Date.now() + 400;
  return response.json();
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
  if (doc.querySelector('parsererror')) throw new Error(i18n('arxivParseFailed'));
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
  if (modeName === 'search') return papers;
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
    if (mode === 'saved' && !feed.children.length) showStatus(i18n('savedEmpty'));
    return;
  }
  updateReactionButtons(card, paper);
}
function updateReactionButtons(card, paper) {
  const reaction = reactionFor(paper);
  labelReaction(card.querySelector('.interest'), i18n('reactionInterestActive'), i18n('reactionInterest'), reaction === 'interest');
  labelReaction(card.querySelector('.read'), i18n('reactionReadActive'), i18n('reactionRead'), reaction === 'read');
  labelReaction(card.querySelector('.skip'), i18n('reactionSkipActive'), i18n('reactionSkip'), reaction === 'skip');
}
function discoveryBadges(paper, extra = {}) {
  const badges = [];
  const ageDays = paperAgeDays(paper);
  if (extra.classic || (Number.isFinite(paper.citationCount) && paper.citationCount >= Number(settings.classicsMinCitations || 0))) badges.push(i18n('badgeHighlyCited'));
  if (ageDays >= 0 && ageDays <= 7) badges.push(i18n('badgeNew'));
  if (reactionAffinity(paper) > 0) badges.push(i18n('badgeCloseToInterests'));
  if (savedPapers[paper.id]) badges.push(i18n('badgeSaved'));
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
function looksLikeArxivCategory(category) {
  return /^[a-z]+(?:-[a-z]+)*(?:\.[A-Za-z0-9-]+)?$/.test(category || '');
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
  const abstract = fragment.querySelector('.abstract');
  const pdf = fragment.querySelector('.pdf');
  abstract.href = paper.abstractUrl || `https://arxiv.org/abs/${baseArxivId(paper.id)}`;
  abstract.textContent = paper.abstractLabel || 'arXiv';
  if (paper.pdfUrl) pdf.href = paper.pdfUrl;
  else pdf.hidden = true;
  save.textContent = savedPapers[paper.id] ? i18n('savedStar') : i18n('save');
  const citation = fragment.querySelector('.citation-count');
  if (Number.isFinite(paper.citationCount)) {
    citation.hidden = false;
    const citationLabel = i18n('citationCount', paper.citationCount.toLocaleString(i18nLocale()));
    citation.textContent = `${citationLabel}${paper.citationSource ? ` · ${paper.citationSource}` : ''}`;
  }
  if (extra.classic) fragment.querySelector('.classic-badge').hidden = false;
  renderDiscoveryBadges(card, paper, extra);
  updateReactionButtons(card, paper);
  fragment.querySelector('.interest').addEventListener('click', () => setReaction(paper, 'interest', card));
  fragment.querySelector('.read').addEventListener('click', () => setReaction(paper, 'read', card));
  fragment.querySelector('.skip').addEventListener('click', () => setReaction(paper, 'skip', card));
  sameAuthor.hidden = !paper.authors[0];
  sameAuthor.addEventListener('click', () => explore(`au:"${arxivQuoted(paper.authors[0])}"`, i18n('authorExploreLabel', paper.authors[0])));
  sameField.hidden = !looksLikeArxivCategory(paper.categories[0]);
  sameField.addEventListener('click', () => explore(`cat:${paper.categories[0]}`, i18n('fieldExploreLabel', paper.categories[0])));
  readMore.addEventListener('click', () => {
    const collapsed = summaryEl.classList.toggle('collapsed');
    readMore.textContent = collapsed ? i18n('readMore') : i18n('collapse');
  });
  save.addEventListener('click', async () => {
    if (savedPapers[paper.id]) { delete savedPapers[paper.id]; save.textContent = i18n('save'); if (mode === 'saved') card.remove(); }
    else { savedPapers[paper.id] = paper; save.textContent = i18n('savedStar'); }
    await persistSaved();
    if (mode === 'saved' && !feed.children.length) showStatus(i18n('savedEmpty'));
  });
  feed.appendChild(fragment);
}
function showStatus(message) { status.hidden = false; status.textContent = message; }
function hideStatus() { status.hidden = true; }

async function loadLatest() {
  if (loading || exhausted || mode !== 'latest') return;
  loading = true; showStatus(start ? i18n('loadingMore') : i18n('loadingLatest'));
  try {
    const result = await fetchPapers(apiUrl({ search_query: activeQuery(), start, max_results: settings.batchSize, sortBy: 'submittedDate', sortOrder: 'descending' }));
    if (!result.papers.length) { exhausted = true; showStatus(i18n('noMatchingPapers')); return; }
    rankForTimeline(visiblePapers(result.papers), 'latest').forEach(p => renderPaper(p));
    start += result.papers.length; exhausted = result.papers.length < settings.batchSize;
    exhausted ? showStatus(i18n('endOfTimeline')) : hideStatus();
  } catch (e) { showStatus(e.message.startsWith('arXiv HTTP 5') ? i18n('arxivTemporaryRefresh') : i18n('loadFailed', e.message)); }
  finally { loading = false; }
}

async function loadSearch() {
  if (loading || exhausted || mode !== 'search') return;
  const query = searchInputQuery(searchText);
  if (!query) { showStatus(i18n('searchEmpty')); return; }
  loading = true; showStatus(start ? i18n('loadingMore') : i18n('searchingPapers'));
  try {
    const result = await fetchPapers(apiUrl({ search_query: query, start, max_results: settings.batchSize, sortBy: 'relevance', sortOrder: 'descending' }));
    if (!result.papers.length) { exhausted = true; showStatus(i18n('searchNoResults')); return; }
    rankForTimeline(visiblePapers(result.papers), 'search').forEach(p => renderPaper(p));
    start += result.papers.length; exhausted = result.papers.length < settings.batchSize;
    exhausted ? showStatus(i18n('endOfTimeline')) : hideStatus();
  } catch (e) { showStatus(e.message.startsWith('arXiv HTTP 5') ? i18n('arxivTemporaryRetry') : i18n('loadFailed', e.message)); }
  finally { loading = false; }
}

async function loadClassics() {
  const source = settings.classicsSearchSource || 'auto';
  if (source === 'arxiv') { loadFilteredRandom('classics'); return; }
  const handled = await loadInspireClassics(source === 'auto');
  if (!handled && mode === 'classics') loadFilteredRandom('classics');
}

async function loadInspireClassics(allowFallback) {
  if (loading || mode !== 'classics') return true;
  loading = true; showStatus(i18n('inspireSearching'));
  try {
    const query = inspireClassicsQuery();
    const target = Math.min(settings.batchSize, 10);
    const pageSize = 25;
    const probe = await fetchInspireSearch(query, 1, 1);
    const available = Math.min(inspireTotal(probe), 500);
    if (!available) {
      if (allowFallback) return false;
      showStatus(i18n('inspireNoPapers'));
      return true;
    }
    const accepted = [];
    for (let attempt = 0; attempt < 5 && accepted.length < target; attempt++) {
      let page = Math.floor(Math.random() * Math.max(1, Math.ceil(available / pageSize))) + 1;
      for (let i = 0; i < 8 && randomSeen.has(`inspire:${page}`); i++) page = Math.floor(Math.random() * Math.max(1, Math.ceil(available / pageSize))) + 1;
      randomSeen.add(`inspire:${page}`);
      const result = await fetchInspireSearch(query, page, pageSize);
      const papers = (result.hits?.hits || []).map(parseInspirePaper).filter(Boolean);
      rankForTimeline(visiblePapers(papers), 'classics').forEach(paper => {
        if (accepted.length < target && passesCitation(paper, citationRange('classics')) && !document.querySelector(`[data-id="${CSS.escape(paper.id)}"]`)) accepted.push(paper);
      });
    }
    accepted.forEach(paper => renderPaper(paper, { classic: true }));
    if (!accepted.length) showStatus(i18n('inspireNoPapersAdvice'));
    else if (accepted.length < target) showStatus(i18n('partialFoundMore', accepted.length));
    else hideStatus();
    return true;
  } catch (error) {
    if (allowFallback && !(error instanceof CitationRateLimitError)) return false;
    showStatus(error instanceof CitationRateLimitError ? i18n('inspireRateLimit') : i18n('loadFailed', error.message));
    return true;
  } finally { loading = false; }
}

async function loadFilteredRandom(modeName) {
  if (loading || mode !== modeName) return;
  loading = true; showStatus(modeName === 'classics' ? i18n('classicsSearching') : i18n('randomSearching'));
  try {
    const dates = timelineDateRange(modeName);
    const query = datedQuery(modeName === 'classics' ? classicsQuery() : activeQuery(), dates.startDate, dates.endDate);
    const probe = await fetchPapers(apiUrl({ search_query: query, start: 0, max_results: 1, sortBy: 'submittedDate', sortOrder: 'descending' }));
    const available = Math.min(probe.total, 30000);
    if (!available) { showStatus(i18n('noPapersForFieldPeriod')); return; }
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
    if (rateLimited && accepted.length) showStatus(i18n('citationApiPartial', accepted.length));
    else if (rateLimited) showStatus(i18n('citationApiRateLimit'));
    else if (!accepted.length) showStatus(i18n('noRandomMatch'));
    else if (accepted.length < target) showStatus(i18n('partialFoundMore', accepted.length));
    else hideStatus();
  } catch (e) { showStatus(e.message.startsWith('arXiv HTTP 5') ? i18n('arxivTemporaryRetry') : i18n('loadFailed', e.message)); }
  finally { loading = false; }
}

function showSaved() {
  const papers = visiblePapers(Object.values(savedPapers)).sort((a, b) => new Date(b.published) - new Date(a.published));
  if (!papers.length) showStatus(i18n('savedEmpty'));
  else { hideStatus(); papers.forEach(p => renderPaper(p)); }
}
function updateIntro() {
  modeIntro.hidden = false;
  if (explorationQuery && mode !== 'search') modeIntro.textContent = i18n('explorationIntro', explorationLabel);
  else if (mode === 'search') modeIntro.textContent = searchText ? i18n('searchIntroWithQuery', searchText) : i18n('searchIntro');
  else if (mode === 'random') modeIntro.textContent = i18n('randomIntro', currentField().label);
  else if (mode === 'classics') {
    const intro = (settings.classicsSearchSource || 'auto') === 'arxiv' ? i18n('classicsIntroArxiv', [currentField().label, classicsEraLabel()]) : i18n('classicsIntroInspire', [currentField().label, classicsEraLabel()]);
    modeIntro.textContent = classicsSearchText ? `${intro} ${i18n('classicsSearchIntro', classicsSearchText)}` : intro;
  }
  else modeIntro.hidden = true;
}
function reloadMode() {
  feed.replaceChildren(); start = 0; exhausted = false; updateIntro();
  shuffleButton.hidden = !['random', 'classics'].includes(mode);
  classicsEraTabs.hidden = mode !== 'classics';
  fieldControl.hidden = mode === 'search';
  fieldControl.style.display = mode === 'search' ? 'none' : '';
  searchForm.hidden = mode !== 'search';
  classicsSearchForm.hidden = mode !== 'classics';
  fieldSelect.disabled = mode === 'saved';
  if (mode === 'latest') loadLatest();
  else if (mode === 'search') loadSearch();
  else if (mode === 'random') loadFilteredRandom('random');
  else if (mode === 'classics') loadClassics();
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
function renderClassicsEraTabs() {
  classicsEraTabs.replaceChildren();
  CLASSICS_ERAS.forEach(era => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'era-tab';
    button.dataset.era = era.id;
    button.textContent = classicsEraLabel(era);
    button.classList.toggle('active', era.id === selectedClassicsEra);
    button.addEventListener('click', async () => {
      selectedClassicsEra = era.id;
      await chrome.storage.local.set({ lastClassicsEra: selectedClassicsEra });
      randomSeen.clear();
      renderClassicsEraTabs();
      if (mode === 'classics') reloadMode();
    });
    classicsEraTabs.appendChild(button);
  });
}
fieldSelect.addEventListener('change', () => { selectedField = fieldSelect.value; explorationQuery = ''; explorationLabel = ''; randomSeen.clear(); reloadMode(); });
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchMode(tab.dataset.mode)));
searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  searchText = searchInput.value.trim();
  await chrome.storage.local.set({ lastSearchText: searchText });
  mode = 'search';
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  reloadMode();
});
classicsSearchForm.addEventListener('submit', async event => {
  event.preventDefault();
  classicsSearchText = classicsSearchInput.value.trim();
  await chrome.storage.local.set({ lastClassicsSearchText: classicsSearchText });
  randomSeen.clear();
  mode = 'classics';
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
  reloadMode();
});
shuffleButton.addEventListener('click', () => { feed.replaceChildren(); randomSeen.clear(); reloadMode(); });
document.querySelector('#refreshButton').addEventListener('click', reloadMode);
document.querySelector('#optionsButton').addEventListener('click', () => chrome.runtime.openOptionsPage());
new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  if (mode === 'latest') loadLatest();
  if (mode === 'search' && feed.children.length) loadSearch();
  if (mode === 'random' && feed.children.length) loadFilteredRandom('random');
  if (mode === 'classics' && feed.children.length) loadClassics();
}, { rootMargin: '500px' }).observe(sentinel);

(async () => {
  await i18nReady;
  settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (!Array.isArray(settings.fields) || !settings.fields.length) settings.fields = BUILTIN_FIELDS;
  const localState = await chrome.storage.local.get({ lastSearchText: '', lastClassicsEra: 'settings', lastClassicsSearchText: '' });
  searchText = localState.lastSearchText;
  classicsSearchText = localState.lastClassicsSearchText;
  selectedClassicsEra = normalizeClassicsEraId(localState.lastClassicsEra);
  searchInput.value = searchText;
  classicsSearchInput.value = classicsSearchText;
  populateFields();
  renderClassicsEraTabs();
  selectedField = settings.fields.some(f => f.id === settings.defaultField) ? settings.defaultField : settings.fields[0].id;
  fieldSelect.value = selectedField;
  await loadSaved(); await loadReactions(); reloadMode();
})();
