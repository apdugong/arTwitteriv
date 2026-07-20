import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (manifest.default_locale !== 'en') throw new Error('manifest default_locale must be en');

const localeNames = ['en', 'ja'];
const locales = {};
for (const localeName of localeNames) {
  locales[localeName] = JSON.parse(await readFile(path.join(root, '_locales', localeName, 'messages.json'), 'utf8'));
}

function localizedMessage(value, localeName = manifest.default_locale) {
  const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(value || '');
  return match ? locales[localeName][match[1]]?.message || '' : value;
}

if (localizedMessage(manifest.name) !== 'arTwitteriv') throw new Error('manifest name must resolve to arTwitteriv');

const referenced = [
  manifest.action?.default_popup,
  manifest.options_page,
  manifest.background?.service_worker,
].filter(Boolean);

for (const relative of referenced) {
  await access(path.join(root, relative), constants.R_OK);
}

const htmlFiles = ['feed.html', 'options.html', 'popup.html'];
const htmlReferencePattern = /\b(?:href|src)="([^"]+)"/g;
for (const relative of htmlFiles) {
  const html = await readFile(path.join(root, relative), 'utf8');
  for (const [, reference] of html.matchAll(htmlReferencePattern)) {
    if (/^(?:https?:|chrome:|#)/.test(reference)) continue;
    await access(path.join(root, reference), constants.R_OK);
  }
}

const jsFiles = ['background.js', 'feed.js', 'i18n.js', 'options.js', 'popup.js', 'presets.js'];
for (const relative of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`Syntax check failed: ${relative}`);
  }
}

const usedMessageKeys = new Set();
for (const value of [manifest.name, manifest.description, manifest.action?.default_title]) {
  const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(value || '');
  if (match) usedMessageKeys.add(match[1]);
}
for (const relative of htmlFiles) {
  const html = await readFile(path.join(root, relative), 'utf8');
  for (const [, key] of html.matchAll(/\bdata-i18n(?:-[a-z-]+)?="([^"]+)"/g)) usedMessageKeys.add(key);
}
for (const relative of jsFiles) {
  const js = await readFile(path.join(root, relative), 'utf8');
  for (const [, key] of js.matchAll(/\bi18n\(\s*['"]([A-Za-z0-9_]+)['"]/g)) usedMessageKeys.add(key);
}
[
  'serendipityBalanced',
  'serendipityClose',
  'serendipityWeird',
  'serendipityAncient',
  'serendipityChaos',
  'serendipityIntroBalanced',
  'serendipityIntroClose',
  'serendipityIntroWeird',
  'serendipityIntroAncient',
  'serendipityIntroChaos',
  'citationGuessLessThan',
  'citationGuessRange',
  'citationGuessAtLeast'
].forEach(key => usedMessageKeys.add(key));
for (const localeName of localeNames) {
  for (const key of usedMessageKeys) {
    if (!locales[localeName][key]?.message) throw new Error(`Missing ${localeName} i18n message: ${key}`);
  }
}

const presetsSource = await readFile(path.join(root, 'presets.js'), 'utf8');
const { BUILTIN_FIELDS, DEFAULT_SETTINGS } = vm.runInNewContext(`${presetsSource}; ({ BUILTIN_FIELDS, DEFAULT_SETTINGS });`);
const categoryQueryPattern = /^cat:[A-Za-z0-9.-]+(?:\s+OR\s+cat:[A-Za-z0-9.-]+)*$/;
if (!BUILTIN_FIELDS.every(field => categoryQueryPattern.test(field.query))) {
  throw new Error('built-in field presets must use only arXiv category queries');
}
const fieldById = Object.fromEntries(BUILTIN_FIELDS.map(field => [field.id, field]));
if (fieldById.cond_mat?.query !== 'cat:cond-mat') throw new Error('built-in fields must include cat:cond-mat');
if (fieldById.cond_mat_str_el?.query !== 'cat:cond-mat.str-el') throw new Error('built-in fields must include cat:cond-mat.str-el');
if (DEFAULT_SETTINGS.defaultField !== 'hep_th') throw new Error('default field must be hep-th');
if (DEFAULT_SETTINGS.classicsStartDate !== '1991-01-01') throw new Error('classics start date must target old-school arXiv-era papers');
if (DEFAULT_SETTINGS.classicsEndDate !== '2012-12-31') throw new Error('classics end date must target old-school arXiv-era papers');
if (DEFAULT_SETTINGS.classicsMinCitations !== 200) throw new Error('classics minimum citations must be 200');
if (DEFAULT_SETTINGS.classicsMaxCitations !== 5000) throw new Error('classics maximum citations must be 5000');
const feedSource = await readFile(path.join(root, 'feed.js'), 'utf8');
for (const eraId of ['1970_1979', '1980_1989', '1990_1994', '1995_1999', '2000_2004', '2005_2009', '2010_2014', '2015_2019', '2020_now']) {
  if (!feedSource.includes(`id: '${eraId}'`)) throw new Error(`missing classics era: ${eraId}`);
}
if (!feedSource.includes('classicsSearchText')) throw new Error('classics timeline must support search filtering');
if (!feedSource.includes("'hep-th': 'Theory-HEP'") || !feedSource.includes('subject:')) throw new Error('pre-arXiv classics must support INSPIRE subject queries');
if (!feedSource.includes('SERENDIPITY_MODES')) throw new Error('random timeline must support the serendipity dial');
if (!feedSource.includes('citationGuessOptions')) throw new Error('paper cards must support adaptive citation guessing');

const baseArxivId = value => String(value || '').split('/abs/').pop().replace(/v\d+$/i, '');
const versionedIds = [
  ['https://arxiv.org/abs/2301.01234v1', '2301.01234'],
  ['https://arxiv.org/abs/hep-th/9901001v2', 'hep-th/9901001'],
  ['2401.00001v12', '2401.00001'],
];
for (const [input, expected] of versionedIds) {
  if (baseArxivId(input) !== expected) throw new Error(`arXiv version suffix was not removed from ${input}`);
}

console.log(`OK: ${localizedMessage(manifest.name)} ${manifest.version}`);
