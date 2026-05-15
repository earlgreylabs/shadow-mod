# ShadowMod

A Devvit app that trains new Reddit moderators through structured shadow decisions — without ever touching live content.

Built for the [Reddit Mod Tools and Migrated Apps Hackathon](https://mod-tools-migration.devpost.com/) (May 2026).

---

## The problem

New moderators learn by doing — which means early mistakes happen on real posts in front of real community members. Reddit's built-in Training Queue only supports binary approve/remove decisions with immediate per-post feedback. There's no way to practise the full range of mod actions, no longitudinal view of a trainee's patterns, and no structured comparison between a trainee's call and an experienced mod's independent judgment.

## How it works

1. **Shadow mod** opens a post in the mod queue and selects "Record shadow decision" — they choose an action (approve, remove, flair, warn, ban, escalate) and write their reasoning. The action is **not executed**.
2. **Senior mod** sees "Review shadow decision" on the same post and records their own independent decision — **without seeing the trainee's call first** (blind review).
3. When the real mod action is taken on the post, ShadowMod detects it via a trigger and **schedules a report**.
4. The trainee receives a **comparison report** via modmail: their decision vs the senior's decision vs the final outcome, with reasoning from both sides.
5. Over time, **longitudinal stats** track trainee accuracy and reveal patterns (e.g. consistently over-removing political content).

## Key design decisions

- **Blind senior review** — the senior records their call before seeing the trainee's, eliminating anchoring bias in feedback.
- **Full action vocabulary** — approve, remove, flair, warn, temp ban, perm ban, escalate, and any custom action the subreddit configures. Not just approve/remove.
- **Async, not immediate** — feedback arrives after the senior reviews, mirroring real moderation flow.
- **ModAction trigger** — we don't intercept or replace the real mod workflow. We listen passively and generate the report when the real action fires.

## Tech stack

- **Platform:** [Devvit](https://developers.reddit.com) (Reddit Developer Platform)
- **Server:** Hono + Node (`@devvit/web`)
- **Storage:** Devvit Redis (namespaced per subreddit)
- **Language:** TypeScript

## Development

```bash
pnpm install
pnpm run build       # compile
pnpm run dev         # devvit playtest — live test on a subreddit
pnpm run upload      # upload to Reddit developer marketplace
```

Requires the [Devvit CLI](https://developers.reddit.com/docs/cli) and a Reddit account with developer access.

## Project structure

```
src/
├── shared/
│   └── types.ts              — shared types (ShadowDecision, SeniorDecision, Report…)
└── server/
    ├── index.ts              — Hono app entry point
    ├── core/
    │   ├── config.ts         — senior mod list (Redis)
    │   ├── decisions.ts      — Redis CRUD for shadow + senior decisions
    │   └── reports.ts        — report generation and delivery
    └── routes/
        ├── menu.ts           — menu action handlers
        ├── forms.ts          — form submission handlers
        ├── triggers.ts       — ModAction trigger → schedule report
        └── cron.ts           — report delivery job
```

## Submission

See [`submission/`](submission/) for the hackathon presentation materials.

---

Built by [@earlgreylabs](https://github.com/earlgreylabs) · u/EarlGrey__ on Reddit
