# arTwitteriv

arTwitteriv is a Manifest V3 Chrome extension for browsing arXiv papers in a social-media-style vertical timeline.

The default interface and documentation are in English. A Japanese Chrome locale is also included for the extension UI.

## Features

- Latest-paper timeline for editable arXiv field presets
- Random timeline filtered by field, date range, and citation-count range
- Classics timeline that searches for highly cited papers at runtime instead of using a fixed list
- INSPIRE-first classics search with an arXiv-based fallback
- Runtime citation counts from Semantic Scholar and, for high-energy physics papers, INSPIRE
- Editable field tabs with a display name and arXiv query
- Optional author-name filter
- Saved-paper timeline
- Lightweight reactions: interested, read, and skip
- Abstract and PDF links that strip arXiv version suffixes such as `v1` so they open the latest version

Citation counts are fetched from external APIs at runtime. Semantic Scholar and INSPIRE may rate-limit requests, fail temporarily, or have no record for some papers; arTwitteriv surfaces those partial failures instead of silently showing an empty feed as success.

## Load In Chrome

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this `arTwitteriv` folder.

## Settings

Open the extension options page to edit:

- Field tabs and their arXiv queries
- Default field
- Optional author filter
- Citation source mode: automatic, Semantic Scholar only, or INSPIRE only
- Random timeline date and citation filters
- Classics timeline search source, date range, and citation filters

Settings and saved papers are stored in Chrome storage, not in files in this repository.

## Checks

Use Node.js 18 or later and run:

```bash
npm test
```

There are no external npm package dependencies, so `npm install` is not required.

## Git Setup

From this folder, run:

```bash
./setup_git.sh
```

Or initialize manually:

```bash
git init
git branch -M main
git add .
git commit -m "Initial import of arTwitteriv"
```

See [MIGRATION.md](MIGRATION.md) for GitHub and Codex handoff notes.

## 日本語メモ

arTwitteriv は、arXiv論文をSNS風の縦型タイムラインで眺めるChrome拡張です。英語を既定にしていますが、日本語Chrome向けのUIロケールも含めています。Chromeで設定を変更しても、その内容は `chrome.storage` に保存されるだけで、GitHub上のファイルには反映されません。

## Disclaimer

arTwitteriv is an independent, unofficial open-source project.

It is not affiliated with, endorsed by, or sponsored by arXiv, X Corp., or Twitter. "arXiv" and related marks belong to their respective owners.

This project has been developed substantially with the assistance of generative AI, including AI-generated code, documentation, and design suggestions. The resulting software is reviewed and maintained by the project owner, but it may still contain errors, incomplete implementations, or unintended behavior.

Users should independently verify important information obtained through this application, including paper metadata, citation counts, and external links.
