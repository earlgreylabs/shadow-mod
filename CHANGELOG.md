# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.2.0] — 2026-06-02

### Added

- **Reviewer Stats tracking**: Reviewers now have their own stats recorded when reports are compiled. Checking stats as a Reviewer displays their total reviews compared, trainees agreed, trainees diverged, and the trainee agreement rate.
- **Modmail delivery fallback**: If a report PM to a reviewer fails (e.g. because they have PMs/DMs disabled), the app now automatically falls back to sending the report to the subreddit's Mod Inbox (modmail).
- **Redis configuration fallback**: `getConfig()` now falls back to reading from Redis if the native Devvit settings are empty, providing backward compatibility with older configurations.
- **Moderation Lifecycle panel**: Added a styled, responsive CSS/HTML panel in `docs/index.html` visualizing the 3-step lifecycle.
- **Out-of-order execution support**: Reviewers can now review posts that have already had real mod actions taken on them. The app detects this via `reddit.getPostById` and schedules/generates the comparison report immediately.
- **Local release automation**: Added `scripts/release.js` (registered as `pnpm run release`) to automate checking Git status, prompting for version bump, updating package version and CHANGELOG.md, running validation checks, committing, and git tagging.

### Changed

- **Trainee/Senior prefixes**: Prefixed the post-level mod menu descriptions with `(trainee)` and `(senior)` to clarify roles.
- **Review queue label**: Renamed the "Review queue" mod menu action and form title to "ShadowMod review queue" to improve scannability.
- **Settings documentation**: Updated `docs/index.html` setup steps to describe configuring Reviewer lists via Mod Tools -> Apps -> ShadowMod -> Installation Settings.
- **Devvit 0.13.0 Upgrade**: Upgraded to `@devvit/start`, `@devvit/web`, and `devvit` dependencies to `0.13.0`.
- **Subreddit App Settings**: Migrated config settings from custom Redis-based forms to native Reddit **Mod Tools -> Apps -> ShadowMod -> Settings**. Deleted old custom settings menu actions and form handlers.
- **Report Delivery**: Switched from modmail reports to sending direct PMs to both the Observer and Reviewer via `reddit.sendPrivateMessage` (with fallback to mod notes) to prevent modmail clutter.
- **GitHub Release Workflow**: Updated release workflow to automate public publishing (`devvit publish --public`) and extract release notes from `CHANGELOG.md` dynamically.

### Fixed

- **Redundant stats buttons**: Removed the redundant "Done"/"Close" double buttons on the read-only stats modal, leaving a single "Close" action.
- **Report scheduling race conditions**: Implemented atomic locking using `redis.zRem` in the `onModAction` trigger and `/review-submit` form to prevent duplicate report generation under high concurrent actions.

---

## [1.1.0] — 2026-05-26

### Added

- **Reviewer notification**: after a real mod action closes a post, the Reviewer now receives a private report alongside the Observer. The report is framed from the Reviewer's perspective: Observer's call, Reviewer's call, final outcome, and whether they matched. Delivered via `sendPrivateMessageAsSubreddit` (sent from the subreddit rather than the app account to bypass personal DM restrictions), with fallback to a direct PM and then a mod note. The shared mod inbox is never used, keeping feedback private between the Reviewer and the app.

---

## [1.0.0] — 2026-05-26

### Added

- **PRIVACY.md**: documents that all data stays within Reddit/Devvit infrastructure — no external servers or databases.
- **CONTRIBUTING.md**: development workflow, TypeScript conventions, CHANGELOG rules, PR format, and issue reporting guide.
- **LICENSE.md**: MIT licence.
- **`.agents/rules/`**: internal AI tooling docs covering Redis patterns (Zod conventions, sorted-set format, `Promise.all`) and Devvit patterns (form session bridge, guard clauses, `t3_` prefix normalisation).

### Changed

- **README.md**: restructured to serve as both app directory listing and developer reference. Problem statement, how-it-works steps, and key design decisions now lead; technical sections follow.
- **HACKATHON.md**: fully synced with v0.4.2 implementation. Corrected Core Flow (pull-based Review queue replaces push notification), Components table (menu actions and modmail, not custom post types), data model (three-state status, correct field names), Storage (Devvit Redis with key pattern table), and Open Questions (resolved KV Store and role-gating items; added stale-observation and zScan pagination as open).
- **JSDoc on all exports**: every exported function, type alias, and schema now has a documentation comment with business/semantic context, per Google TypeScript guidelines.
- **Parallel Redis fetches**: `getPendingForPost`, `getAllPending`, and `getReviewerDecisionsForPost` now use `Promise.all` instead of sequential `await` inside loops.
- **`isReviewer`**: uses `.some()` with short-circuit evaluation instead of `.map().includes()`.
- **`splitMember` helper**: extracted to replace repeated `indexOf(':')` pattern across three functions in `decisions.ts`.
- **`forms.ts`**: removed redundant ternary guards after early-return checks; collapsed `ctxUserId`/`userId` alias.

---

## [0.4.2] — 2026-05-26

### Added

- **Review queue shows post titles**: the queue handler fetches each post's title via `reddit.getPostById()` in parallel (`Promise.all`). Labels read `"Post title here — observed by: observer_user"`. Titles longer than 60 characters are truncated with `...`; falls back to the post ID if the API call fails.
- **Navigate-to-post flow**: selecting a post from the review queue navigates the Reviewer directly to that post before opening the review form, rather than opening the form from the subreddit context.

### Fixed

- **Duplicate observation guard**: `hasObserverDecision` was checking `!== undefined` but `redis.get()` returns `null` on a cache miss. Now correctly checks `!== null`. A second guard was also added to the form submit handler.
- **Form submit payloads**: Devvit sends a flat root object, not `{ values: {} }`. All form submit handlers updated to read fields from the root body.

---

## [0.4.1] — 2026-05-25

### Fixed

- **Settings form always shows current Reviewers**: the `/settings` menu handler now includes the saved Reviewer list in the form `description` (`Currently saved: username1, username2` or `(none)` when empty). This is visible regardless of whether Devvit renders the `defaultValue` pre-fill. The `defaultValue` is retained as a fallback.
- **`u/` prefix stripped on save**: the `/settings-submit` handler strips a leading `u/` (case-insensitive) from each username after splitting and trimming. Usernames entered as `u/EarlGrey__` are stored as `EarlGrey__`, matching the bare username that `context.username` and `isReviewer()` compare against.

### No Redis schema changes

Existing stored Reviewer usernames are unaffected. Any previously stored `u/`-prefixed usernames will be mismatched; a Reviewer should re-save settings after upgrading to clear them.

---

## [0.4.0] — 2026-05-25

### Added

- **Review queue** (`POST /internal/menu/queue`): a new "Review queue" subreddit-level menu action (Reviewer-only, server-side guarded). Reviewers can open it from any post to see every post with at least one pending Observation. They select a post and are taken directly into the review form for that post (chained forms via `queueForm` → `reviewForm` → existing `/review-submit`).
- `getAllPending()` in `decisions.ts`: scans the full `pending` sorted set, groups by postId, filters to `status === 'pending_review'`, and returns `{ postId: string; observerNames: string[] }[]`.
- `POST /internal/form/queue-submit` form handler: reads the selected postId, stores a form session so `/review-submit` can resolve the post, then chains to the `reviewForm`.
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

Terminology rename to Observer/Reviewer across code, devvit.json, and docs. Full deterministic toolchain added so correctness is enforced by the toolchain rather than manual review.

### Breaking

- Route paths renamed:
  - `/internal/menu/shadow-decision` → `/internal/menu/observation`
  - `/internal/menu/senior-review` → `/internal/menu/review`
  - `/internal/form/shadow-decision-submit` → `/internal/form/observation-submit`
  - `/internal/form/senior-review-submit` → `/internal/form/review-submit`
- Form names: `shadowDecisionForm` → `observationForm`, `seniorReviewForm` → `reviewForm`
- Menu labels updated: "Record observation", "Record review"

### Migration

Redis keys were already on Observer/Reviewer prefixes from the prior session, so no data migration is needed. Existing test installs must reinstall to pick up the new route paths.

### Added

- **Zod schemas** in `src/shared/schemas.ts`: single source of truth for runtime and compile-time shape. `types.ts` re-exports `z.infer<>` aliases. Redis reads use `safeParse` and return `null` (with a `console.warn`) on corruption; Redis writes use `parse` before serialising.
- **Vitest** test suite (29 tests, 4 files) covering `decisions`, `reports`, menu routes, and form routes. Coverage of `src/server/core/` ~93%.
- **ESLint** flat config (`recommendedTypeChecked` + `eqeqeq`, `no-explicit-any`, `consistent-type-imports`, `no-floating-promises`).
- **Prettier** (`semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`) with `.prettierignore` skipping lockfiles and existing docs.
- **Lefthook** pre-commit (types, lint, format, test) and pre-push (build) hooks. Install via `pnpm exec lefthook install`.
- **New scripts:** `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`, `test:coverage`, `check`. `upload` now gates on `check`.
- CI extended to run `type-check`, `lint`, `format:check`, `test`, `build`.

### Changed

- Internal `deliverReport` renamed to `generateReport` to match the scheduler job name. Cron handler updated.

---

## [0.2.0] — 2026-05-15

### Added

- "My ShadowMod stats" subreddit menu action: surfaces per-Observer accuracy stats (total Observations, matched, diverged, accuracy %) as a read-only form.
- Separate `reviewers` Redis sorted set so `getReviewDecisionsForPost` correctly finds Reviews by Reviewer ID.
- CI/CD: GitHub Actions workflows for build on push and `devvit upload` on version tags.

### Fixed

- `getPendingForPost` was filtering to `pending_review` status only — the trigger could never schedule reports because Observations are moved to `pending_report` after the Reviewer submits. Now returns all statuses; callers filter.
- `getReviewDecisionsForPost` always returned `[]` because it scanned the Observer `pending` set with Observer IDs. Fixed with a dedicated `reviewers` sorted set.
- `select` form field value type is `string[]` (even for single-select) — fixed in both Observation and Review form handlers.
- `onModAction` trigger body field names corrected to match `OnModActionRequest`: `body.action` (not `body.type`), `body.targetPost` (not `body.target`).
- Removed empty `import {} from '@devvit/web/server'` in `triggers.ts`.
- `getPendingForPost` member split uses `indexOf`/`slice` to handle `t2_` IDs correctly.

---

## [0.1.0] — 2026-05-15

### Added

- Observation recording: Observers record their intended mod action and reasoning without executing it.
- Blind Review: Reviewers record an independent call on the same post before seeing the Observer's Observation.
- `onModAction` trigger: detects real mod actions and schedules Comparison reports.
- Async report delivery: Comparison report sent via modmail (mod note fallback).
- Longitudinal stats: per-Observer accuracy tracking in Redis.
- 7 supported action types: approve, remove, flair, warn, temp_ban, perm_ban, escalate.
- App settings: Reviewer list configurable per subreddit via menu action.
- Initial upload to Reddit Developer Platform as `shadow-mod`.
