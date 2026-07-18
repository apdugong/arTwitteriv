# AGENTS.md — arTwitteriv

## Project
arTwitteriv is a Manifest V3 Chrome extension that presents arXiv papers in a social-media-style timeline.

## Current product requirements
- Keep four timelines: new, random, classics/highly cited, and saved.
- Field tabs are user-editable presets consisting of a display name and an arXiv query.
- Random and highly cited timelines may filter by field, date range, and citation-count range.
- Citation counts are fetched from Semantic Scholar at runtime; do not replace this with a hard-coded classics list.
- Strip arXiv version suffixes such as `v1` from abstract and PDF URLs so links resolve to the latest version.
- Preserve saved papers and settings stored in `chrome.storage.local` unless a migration is deliberately implemented.

## Engineering rules
- Do not add a build step or framework without a clear need. The extension should remain loadable directly from this repository.
- Do not commit API keys, tokens, browser profiles, generated ZIP files, or `.env` files.
- Keep host permissions as narrow as practical.
- Handle arXiv/Semantic Scholar rate limits and partial failures visibly; do not silently present an empty feed as success.
- Avoid wholesale rewrites when a focused change is sufficient.
- Before finishing a task, run `npm test` (or the equivalent commands in `package.json`) and report what was tested.
- Update `CHANGELOG.md` for user-visible changes.

## Manual verification
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load this repository as an unpacked extension.
4. Open the popup and each timeline.
5. Confirm settings survive reopening the extension.
6. Confirm abstract/PDF links contain no arXiv version suffix.
