# ShadowMod

A Devvit app that trains new Reddit moderators through structured Observations, without ever touching live content.

Built for the [Reddit Mod Tools and Migrated Apps Hackathon](https://mod-tools-migration.devpost.com/) (May 2026).

---

## The problem

New moderators learn by doing, which means early mistakes happen on real posts in front of real community members. Reddit's current Training Queue is focused on approve/remove practice with immediate per-post feedback (a useful starting point), but there does not appear to be a built-in structured workflow for practising the full range of mod actions, capturing reasoning, or running a blind parallel Review by an experienced mod for longitudinal comparison.

## How it works

1. The **Observer** opens a post in the mod queue and selects "Record observation". They choose an action (approve, remove, flair, warn, ban, escalate) and write their reasoning. The action is **not executed**.
2. The **Reviewer** sees "Record review" on the same post and records their own independent decision, **without seeing the Observer's call first** (blind review).
3. When the real mod action is taken on the post, ShadowMod detects it via a trigger and **schedules a report**.
4. The Observer receives a **comparison report** via modmail: their Observation vs the Reviewer's Review vs the final Outcome, with reasoning from both sides.
5. Over time, **longitudinal stats** track Observer accuracy and reveal patterns (e.g. consistently over-removing political content).

## Key design decisions

- **Blind Review**: the Reviewer records their call before seeing the Observer's, eliminating anchoring bias in feedback.
- **Full action vocabulary**: approve, remove, flair, warn, temp ban, perm ban, escalate, and any custom action the subreddit configures. Not just approve/remove.
- **Async, not immediate**: feedback arrives after the Reviewer records their Review, mirroring real moderation flow.
- **ModAction trigger**: we don't intercept or replace the real mod workflow. We listen passively and correlate the real action to the pending Review via post ID, action type, and timestamp. Trigger payloads may require supplementary modlog reads for reliable final-outcome detection.

## Tech stack

- **Platform:** [Devvit](https://developers.reddit.com) (Reddit Developer Platform)
- **Server:** Hono + Node (`@devvit/web`)
- **Storage:** Devvit Redis (namespaced per subreddit)
- **Language:** TypeScript

## Development

```bash
pnpm install
pnpm run build       # compile
pnpm run dev         # devvit playtest, live test on a subreddit
pnpm run upload      # upload to Reddit developer marketplace
```

Requires the [Devvit CLI](https://developers.reddit.com/docs/cli) and a Reddit account with developer access.

## Project structure

```md
src/
├── shared/
│   └── types.ts              (shared types: Observation, Review, Report)
└── server/
    ├── index.ts              (Hono app entry point)
    ├── core/
    │   ├── config.ts         (Reviewer list in Redis)
    │   ├── decisions.ts      (Redis CRUD for Observations and Reviews)
    │   └── reports.ts        (report generation and delivery)
    └── routes/
        ├── menu.ts           (menu action handlers)
        ├── forms.ts          (form submission handlers)
        ├── triggers.ts       (ModAction trigger, schedules report)
        └── cron.ts           (report delivery job)
```

---

Built by [@earlgreylabs](https://github.com/earlgreylabs), u/EarlGrey__ on Reddit
