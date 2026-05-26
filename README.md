# ShadowMod

A Devvit app that gives mod teams a structured Observer/Reviewer workflow: Observers record moderation decisions without executing them, Reviewers assess the same posts independently, and a comparison report is delivered after the real mod action lands.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Platform | [Devvit](https://developers.reddit.com) (Reddit Developer Platform) |
| Server | Hono + Node (`@devvit/web`) |
| Storage | Devvit Redis (namespaced per subreddit) |
| Language | TypeScript (strict) |

---

## Development setup

```bash
pnpm install
pnpm run build       # compile + type-check
pnpm run dev         # devvit playtest on a registered test subreddit
pnpm run upload      # upload to Reddit developer marketplace (requires approval)
```

Requires the [Devvit CLI](https://developers.reddit.com/docs/cli) and a Reddit account with developer access. The test subreddit is `r/shadow_mod_dev`.

---

## Project structure

```
src/
├── shared/
│   └── types.ts              # Observation, Review, Report types
└── server/
    ├── index.ts              # Hono app entry point
    ├── core/
    │   ├── config.ts         # Reviewer list management (Redis)
    │   ├── decisions.ts      # Redis CRUD for Observations and Reviews
    │   └── reports.ts        # report generation and modmail delivery
    └── routes/
        ├── menu.ts           # menu action handlers
        ├── forms.ts          # form submission handlers
        ├── triggers.ts       # onModAction trigger: detects real action, schedules report
        └── cron.ts           # generate-report scheduled job
```

---

## Core flow

1. **Observer** selects "Record observation" on a queued post, picks an action (approve, remove, flair, warn, ban, escalate) and writes reasoning. The action is not executed.
2. **Reviewer** selects "Record review" on the same post and records their own decision, blind to the Observer's call.
3. When any mod or AutoModerator takes a real action on the post, the `onModAction` trigger fires and schedules the `generate-report` job.
4. The job produces a comparison report (Observation vs Review vs Outcome, with both reasoning strings) and delivers it to the Observer via modmail. Falls back to a mod note if modmail is unavailable.

---

## Data model

```
Observation
  observationId, postId, subredditId
  observerId, action, reason, timestamp
  status: pending_review | complete

Review
  reviewId, observationId
  reviewerId, action, reason, timestamp

Report
  reportId, observationId
  observerAction, observerReason
  reviewerAction, reviewerReason
  outcome (final mod action)
  agreement: boolean
  createdAt
```

Redis key scheme:

| Key pattern | Contents |
| --- | --- |
| `observation:{postId}:{observerId}` | serialised Observation |
| `review:{postId}:{reviewerId}` | serialised Review |
| `pending` (sorted set) | postIds with open Observations |
| `config:reviewers` (set) | usernames in the Reviewer role |
| `stats:{userId}` | accumulated accuracy stats |

---

## Configuration

Reviewer assignment is managed through the "ShadowMod settings" subreddit menu action (mod-only). Usernames are stored without the `u/` prefix.

App-level config lives in `devvit.json`. Dev subreddit override: `dev.subreddit = "shadow_mod_dev"`.

---

## Releases

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

Built by [@earlgreylabs](https://github.com/earlgreylabs), u/EarlGrey__ on Reddit
