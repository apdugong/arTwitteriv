# Changelog

All notable user-visible changes should be recorded here.

## [0.4.19] - 2026-07-20
- Added a Serendipity dial to steer the Random timeline toward close, weird, ancient, or chaotic picks.
- Added Citation Guess cards that hide fetched citation counts until the user guesses or reveals them.

## [0.4.18] - 2026-07-19
- Extended classics era tabs to start at the 1970s.
- Added a keyword/arXiv-query filter box to the classics timeline.
- Allowed INSPIRE-only classics records to appear when older eras do not have arXiv IDs.

## [0.4.17] - 2026-07-19
- Added era tabs to the classics timeline for switching among settings, 1990s, five-year buckets, and 2020-now.

## [0.4.16] - 2026-07-19
- Added separate default field presets for `cat:cond-mat` and `cat:cond-mat.str-el`.
- Added an undo action after restoring default field presets.

## [0.4.15] - 2026-07-19
- Changed default field presets to arXiv category-based fields.
- Tuned the default classics filters toward old-school arXiv-era high-energy theory papers.

## [0.4.14] - 2026-07-19
- Ensured the field selector is hidden on the Search timeline.

## [0.4.13] - 2026-07-19
- Added a Search timeline tab for ad-hoc keyword searches and advanced arXiv queries without editing field presets.

## [0.4.12] - 2026-07-19
- Added an in-extension language setting for English, Japanese, or automatic Chrome-language selection.

## [0.4.11] - 2026-07-19
- Made English the default extension locale and added Japanese UI localization.
- Changed built-in field preset labels to English for new installs and restored defaults.
- Updated public documentation with English-first README and migration notes.

## [0.4.10] - 2026-07-19
- Made the classics timeline use INSPIRE search first, with an arXiv-based fallback and a configurable classics search source.

## [0.4.9] - 2026-07-18
- Added a setting to choose automatic, Semantic Scholar-only, or INSPIRE-only citation counts.

## [0.4.8] - 2026-07-18
- Added INSPIRE citation-count supplementation for high-energy physics papers.

## [0.4.7] - 2026-07-18
- Added discovery badges and same-author/same-field exploration actions on paper cards.
- Kept random timelines random by avoiding reaction-history ranking and only showing the interest badge for stronger matches.
- Added retries and friendlier messages for temporary arXiv server errors.

## [0.4.6] - 2026-07-18
- Added lightweight paper reactions for interested, read, and skipped papers, with small feed ranking boosts from reaction history.

## [0.4.5] - 2026-07-18
- Added an optional author-name filter to the settings page.

## [0.4.4] - 2026-07-18
- Added local citation-count caching and made classics discovery use fewer Semantic Scholar lookups.
- Raised the default minimum citation count for classics to 500.

## [0.4.3] - 2026-07-18
- Added retry and friendlier partial-result handling when Semantic Scholar rate limits citation lookups.

## [0.4.2] - 2026-07-18
- Registered the background service worker so install-time defaults can run.
- Kept unfiltered random timelines usable when Semantic Scholar has no citation record or citation fetching is unavailable.
- Expanded local checks for extension file references and arXiv version-suffix removal.

## [0.4.1] - 2026-07-18
- Renamed the extension from arXiv Scroll to arTwitteriv.
- Added Git/Codex project files and local validation commands.

## [0.4.0] - 2026-07-18
- Added editable field presets.
- Added date-range and citation-count filters for random papers.
- Replaced the fixed classics list with runtime citation-based discovery.
- Removed arXiv version suffixes from abstract and PDF links.
