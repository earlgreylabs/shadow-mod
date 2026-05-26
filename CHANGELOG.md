# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **Review queue labels show post title**: the `/queue` handler now fetches each post's title via `reddit.getPostById()` in parallel (`Promise.all`) and uses it in the select option label. Labels read `"Post title here — observed by: observer_user"` instead of the raw post ID. Titles longer than 60 characters are truncated with `...`. If the Reddit API call fails for a post, the label falls back to the post ID gracefully.

---

## [0.4.1] — 2026-05-25

### Fixed

- **Settings form always shows current Reviewers**: the `/settings` menu handler now includes the saved Reviewer list in the form `description` (`Currently saved: username1, username2` or `(none)` when empty). This is visible regardless of whether Devvit renders the `defaultValue` pre-fill. The `defaultValue` is retained as a belt-and-suspenders fallback.
- **`u/` prefix stripped on save**: the `/settings-submit` handler now strips a leading `u/` (case-insensitive) from each username after splitting and trimming. Usernames entered as `u/EarlGrey__` are stored as `EarlGrey__`, matching the bare username that `context.username` and `isReviewer()` compare against.

### No Redis schema changes

Existing stored Reviewer usernames are unaffected. Any previously stored `u/`-prefixed usernames will still be mismatched; a Reviewer admin should re-save settings after upgrading to clear them.

---

## [0.4.0] — 2026-05-25

### Added

- **Review queue** (`POST /internal/menu/queue`): a new "Review queue" post-level menu action (Reviewer-only, server-side guarded). Reviewers can open it from any post to see every post subreddit-wide that has at least one `pending_review` observation. They pick a post from a select field and are taken directly into the review form for that post (chained forms via `queueForm` → `reviewForm` → existing `/review-submit`).
- `getAllPending()` in `decisions.ts`: scans the full `pending` sorted set, groups by postId, filters to `status === 'pending_review'`, and returns `{ postId: string; observerNames: string[] }[]`.
- `POST /internal/form/queue-submit` form handler: reads the selected postId from form values, stores a form session so `/review-submit` can resolve the post, then chains directly to the `reviewForm`.
- `queueForm` registered in `devvit.json`.

### No Redis schema changes

`getAllPending()` reads the existing `pending` sorted set. No migration required.

---

## [0.3.1] — 2026-05-19

### Fixed

- Form submissions no longer return "Session error — please try again." Devvit does not forward the `devvit-post` header to form submission requests. Menu handlers now store a short-lived Redis form session (`form-session:{userId}`, 5-minute TTL) before returning `showForm`. Submit handlers read `context.postId` and fall back to the session when it is absent.

### Added

- App profile icon (`assets/icon.png`) wired up via `marketingAssets.icon` in `devvit.json`. Appears on the app's Reddit profile and Dev Portal listing after publish approval.

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
