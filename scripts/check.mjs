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
].filter(Boolean);

for (const relative of referenced) {
  await access(path.join(root, relative), constants.R_OK);
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

console.log(`OK: ${manifest.name} ${manifest.version}`);
