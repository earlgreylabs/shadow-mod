# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] — 2026-05-18

Terminology rename to Observer/Reviewer (completed across code, devvit.json, and docs), plus a full deterministic toolchain so future correctness is enforced by the toolchain rather than agent review.

### Breaking

- Route paths renamed:
  - `/internal/menu/shadow-decision` → `/internal/menu/observation`
  - `/internal/menu/senior-review` → `/internal/menu/review`
  - `/internal/form/shadow-decision-submit` → `/internal/form/observation-submit`
  - `/internal/form/senior-review-submit` → `/internal/form/review-submit`
- Form names: `shadowDecisionForm` → `observationForm`, `seniorReviewForm` → `reviewForm`.
- Menu labels updated: "Record observation", "Record review".

### Migration

Redis keys were already on Observer/Reviewer prefixes from the prior session, so no data migration is needed. Existing test installs must reinstall to pick up the new route paths.

### Deterministic guardrails

### Added

- **Zod schemas** in `src/shared/schemas.ts` — single source of truth for runtime + compile-time shape. `types.ts` now re-exports `z.infer<>` aliases. Redis reads `safeParse` and return `null` (with a `console.warn`) on corruption; Redis writes `parse` before serialising.
- **Vitest** test suite (29 tests, 4 files) covering `decisions`, `reports`, menu routes, and form routes. Coverage of `src/server/core/` ~93%.
- **ESLint** flat config (`recommendedTypeChecked` + `eqeqeq`, `no-explicit-any`, `consistent-type-imports`, `no-floating-promises`).
- **Prettier** (`semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`) with `.prettierignore` skipping lockfiles and existing docs.
- **Lefthook** pre-commit (types, lint, format, test) and pre-push (build) hooks. Install via `pnpm exec lefthook install`.
- **New scripts:** `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `test:coverage`, `check`. `upload` now gates on `check`.
- CI extended to run `type-check`, `lint`, `format:check`, `test`, `build`.

### Changed

- Internal `deliverReport` renamed to `generateReport` to match the scheduler job name. Cron handler updated.

---

## 2026-05-16 — Terminology rename: Observer/Reviewer

Renamed roles to remove seniority-tier connotations that conflict with Reddit community jargon.

### Breaking
- Route paths renamed:
  - `/internal/menu/shadow-decision` → `/internal/menu/observation`
  - `/internal/menu/senior-review` → `/internal/menu/review`
  - `/internal/form/shadow-decision-submit` → `/internal/form/observation-submit`
  - `/internal/form/senior-review-submit` → `/internal/form/review-submit`
- Form names: `shadowDecisionForm` → `observationForm`, `seniorReviewForm` → `reviewForm`

### Non-breaking
- UI labels and toast strings updated to Observer/Reviewer terminology.
- Type names already migrated in prior session (ObserverDecision, ReviewerDecision).
- Redis keys already migrated in prior session (`observer:`, `reviewer:`, `config:reviewers`, `pending_review`).

### Migration for existing installations
No Redis migration required (key prefixes already on Observer/Reviewer). Existing test installs must reinstall to pick up new route paths.

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
