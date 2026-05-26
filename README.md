# ShadowMod

Train new Reddit moderators with structured blind review. Observers record decisions without
executing them, Reviewers assess the same posts independently, and a Comparison report lands
after the real mod action — with reasoning from both sides.

Built for the [Reddit Mod Tools and Migrated Apps Hackathon](https://mod-tools-migration.devpost.com/) (May 2026).

---

## The problem

New moderators learn by doing, which means early mistakes happen on real posts in front of real
community members. Reddit's Training Queue is a useful starting point for approve/remove practice,
but there is no built-in structured workflow for practising the full range of mod actions,
capturing reasoning, or running a blind parallel review by an experienced mod for longitudinal
comparison.

The result: new mods get unsupervised access too early, or experienced mods spend
disproportionate time hand-holding without a scalable feedback mechanism.

---

## How it works

1. The **Observer** opens a post in the mod queue and selects "Record observation". They choose an
   action (approve, remove, flair, warn, ban, escalate) and write their reasoning. The action is
   **not executed**.
2. The **Reviewer** opens the "Review queue" from the subreddit mod menu, picks a post with
   pending Observations, navigates to it, and selects "Record review". They record their own
   independent decision **without seeing the Observer's call first** (blind review).
3. When the real mod action is taken on the post, ShadowMod detects it via a trigger and
   schedules a report.
4. The Observer receives a **Comparison report** via modmail: their Observation vs the Reviewer's
   Review vs the final Outcome, with reasoning from both sides.
5. Over time, **longitudinal stats** track Observer accuracy and reveal patterns.

---

## Key design decisions

- **Blind Review**: the Reviewer records their call before seeing the Observer's, eliminating
  anchoring bias in feedback.
- **Full action vocabulary**: approve, remove, flair, warn, temp ban, perm ban, escalate. Not
  just approve/remove.
- **Review queue**: Reviewers discover pending Observations via a subreddit-level queue menu.
  No push notifications required.
- **Async, not immediate**: feedback arrives after the real mod action lands, mirroring real
  moderation flow and preventing Observers from gaming the system for instant validation.
- **Passive trigger**: ShadowMod listens for real mod actions and correlates them to pending
  Reviews via post ID. It does not intercept or replace the live mod workflow.

---

## Tech stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Platform | [Devvit](https://developers.reddit.com) (Reddit Developer Platform) |
| Server   | Hono + Node (`@devvit/web`)                                    |
| Storage  | Devvit Redis (namespaced per subreddit)                        |
| Language | TypeScript (strict)                                            |

---

## Development setup

```bash
pnpm install
pnpm run build       # compile + type-check
pnpm run dev         # devvit playtest on a registered test subreddit
pnpm run upload      # upload to Reddit developer marketplace (requires approval)
```

Requires the [Devvit CLI](https://developers.reddit.com/docs/cli) and a Reddit account with
developer access. The test subreddit is `r/shadow_mod_dev`.

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

## Data model

```
Observation
  id, postId
  observerId, observerName, action, reason, timestamp
  status: pending_review | pending_report | complete

Review
  postId
  reviewerId, reviewerName, action, reason, timestamp

Report (in-memory, delivered via modmail)
  postId, postTitle, postPermalink
  observer, reviewer, finalAction, agreement, generatedAt
```

Redis key scheme:

| Key pattern                         | Contents                       |
| ----------------------------------- | ------------------------------ |
| `observer:{postId}:{observerId}`    | serialised Observation         |
| `reviewer:{postId}:{reviewerId}`    | serialised Review              |
| `pending` (sorted set)              | postIds with open Observations |
| `reviewers_set` (sorted set)        | postIds with recorded Reviews  |
| `config:reviewers`                  | Reviewer usernames             |
| `stats:{userId}`                    | Observer accuracy totals       |

---

## Configuration

Reviewer assignment is managed through the "ShadowMod settings" subreddit menu action
(mod-only). Usernames are stored without the `u/` prefix.

---

## Releases

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

Built by [@earlgreylabs](https://github.com/earlgreylabs), u/EarlGrey__ on Reddit
