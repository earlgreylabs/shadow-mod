# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-05-15

### Added

- "My ShadowMod stats" subreddit menu action: surfaces per-trainee accuracy stats (total decisions, matched, diverged, accuracy %) as a read-only form
- Separate `seniors` Redis sorted set so `getSeniorDecisionsForPost` correctly finds senior reviews by senior mod ID (previously incorrectly scanned shadow mod IDs)
- CI/CD: GitHub Actions workflows for build on push and `devvit upload` on version tags

### Fixed

- `getPendingForPost` was filtering to `pending_senior` status only — the trigger could never schedule reports because decisions are moved to `pending_report` after the senior reviews. Now returns all statuses; callers filter.
- `getSeniorDecisionsForPost` always returned `[]` because it scanned the shadow `pending` set with shadow mod IDs. Fixed with dedicated `seniors` sorted set.
- `select` form field value type is `string[]` (even for single-select) — fixed in both shadow decision and senior review form handlers.
- `onModAction` trigger body field names corrected to match `OnModActionRequest`: `body.action` (not `body.type`), `body.targetPost` (not `body.target`).
- Removed empty `import {} from '@devvit/web/server'` in triggers.ts.
- `getPendingForPost` member split uses `indexOf`/`slice` to handle t2_ IDs correctly.

---

## [0.1.0] — 2026-05-15

### Added

- Shadow decision recording: new mods record action + reasoning without executing it
- Blind senior review: senior mods record independent call before seeing trainee's decision
- `onModAction` trigger: detects real mod actions and schedules comparison reports
- Async report delivery: comparison report sent via modmail (mod note fallback)
- Longitudinal stats: per-trainee accuracy tracking in Redis
- 7 supported action types: approve, remove, flair, warn, temp_ban, perm_ban, escalate
- App settings: senior mod list configurable per subreddit via menu action
- Initial upload to Reddit Developer Platform as `shadow-mod`
