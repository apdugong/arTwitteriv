import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (manifest.name !== 'arTwitteriv') throw new Error('manifest name must be arTwitteriv');

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

const jsFiles = ['background.js', 'feed.js', 'options.js', 'popup.js', 'presets.js'];
for (const relative of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`Syntax check failed: ${relative}`);
  }
}

const baseArxivId = value => String(value || '').split('/abs/').pop().replace(/v\d+$/i, '');
const versionedIds = [
  ['https://arxiv.org/abs/2301.01234v1', '2301.01234'],
  ['https://arxiv.org/abs/hep-th/9901001v2', 'hep-th/9901001'],
  ['2401.00001v12', '2401.00001'],
];
for (const [input, expected] of versionedIds) {
  if (baseArxivId(input) !== expected) throw new Error(`arXiv version suffix was not removed from ${input}`);
}

console.log(`OK: ${manifest.name} ${manifest.version}`);
