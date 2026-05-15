# ShadowMod — Project Proposal

**Hackathon:** Reddit Mod Tools and Migrated Apps Hackathon
**Deadline:** 2026-05-27 @ 6:00 PM PDT
**Category:** Best New Mod Tool
**Platform:** Devvit (Reddit Developer Platform)

---

## Problem

New moderators learn by doing — which means their early mistakes happen on live content in front of real community members. There is no low-stakes environment where they can practise the full range of moderation decisions (approve, remove, flair, warn, ban, escalate) and receive structured feedback on their judgment compared to an experienced mod.

Reddit's built-in Training Queue is a step in the right direction but is limited to binary approve/remove, gives immediate per-post feedback without longitudinal insight, and does not record independent parallel decisions from a senior mod for comparison.

The result: new mods either get unsupervised access too early, or senior mods spend disproportionate time hand-holding without a scalable feedback mechanism.

---

## Solution: ShadowMod

ShadowMod is a Devvit app that creates a structured shadow moderation workflow:

1. **Shadow mod** encounters a post in the queue and records their decision + reasoning — the action is not executed.
2. **Senior mod** independently reviews the same post and records their own decision + reasoning — without seeing the shadow mod's call first (blind review).
3. The post is actioned in the live queue as normal.
4. Both mods receive a **comparison report**: shadow decision vs senior decision vs final outcome, with reasoning from both sides.
5. Over time, the shadow mod and their mentor can review **analytics**: decision accuracy, consistency trends, content types where they diverge from senior judgment.

---

## Core Flow

```
Shadow mod views post
        │
        ▼
Records: action + reason (not executed)
        │
        ▼
ShadowMod notifies assigned senior mod
        │
        ▼
Senior mod records: action + reason (blind to shadow decision)
        │
        ▼
Senior mod (or AutoModerator) takes real action
        │
        ▼
Report generated: shadow vs senior vs outcome
        │
        ├── Sent to shadow mod (learning feedback)
        └── Logged to analytics dashboard
```

---

## Key Design Decisions

### Blind senior review
Senior records their decision before seeing the shadow mod's call. This eliminates anchoring bias — the feedback is genuinely comparative, not a rationalisation of what the trainee said.

### Full decision vocabulary
Unlike the native Training Queue, ShadowMod supports the full mod action set: approve, remove (with reason), flair, warn, temp ban, permanent ban, escalate to senior, and any custom actions the subreddit configures.

### Async, not immediate
Feedback is delivered after the senior has reviewed, not immediately after the shadow decision. This more closely mirrors real moderation flow and prevents trainees from gaming the system for instant validation.

### Community-configurable rubrics
Each subreddit can define what counts as a "correct" decision for their norms. A political subreddit and a support community have different standards — ShadowMod adapts to both.

---

## Technical Architecture

**Platform:** Devvit (TypeScript)

### Components

| Component | Devvit primitive | Purpose |
|---|---|---|
| Shadow decision form | Custom post / menu action | Shadow mod captures decision + reasoning |
| Senior review form | Custom post / menu action | Senior records decision before seeing shadow's |
| Report post | Custom post type | Structured comparison delivered to both parties |
| Analytics dashboard | Custom post type (mod-only) | Longitudinal metrics per trainee |
| Config panel | App settings | Subreddit-specific decision types, senior mod assignments |

### Data model (key entities)

```
ShadowDecision
  id, postId, subredditId
  shadowModId, action, reason, timestamp
  status: pending_senior | complete

SeniorDecision
  id, shadowDecisionId
  seniorModId, action, reason, timestamp

Report
  id, shadowDecisionId
  shadowAction, shadowReason
  seniorAction, seniorReason
  finalAction
  agreement: boolean
  createdAt
```

### Storage
Devvit KV Store for decision records. Mod log for audit trail.

### Notifications
Devvit's realtime / scheduled jobs to notify senior mods of pending reviews and deliver reports to shadow mods.

---

## Submission Fit

| Judging criterion | ShadowMod |
|---|---|
| Community Impact | Reduces bad early-mod decisions; scales senior mod mentorship; improves community trust |
| Polish & compliance | Devvit-native install, standard mod queue integration, no external dependencies |
| Reliable UX | One-click install; no config required to start; senior assignment via app settings |
| Ecosystem Impact | Applicable to any subreddit with a tiered mod structure |

---

## Differentiation from Reddit Training Queue

Reddit's native Training Queue validates the problem space. ShadowMod goes further in five specific ways — see `../discovery.md` for the full comparison table.

---

## Out of Scope (v1)

- AI-assisted decision suggestions (avoid adding noise to training signal)
- Cross-subreddit analytics
- Integration with external moderation tooling (Toolbox, etc.)

---

## Open Questions

- [ ] Does Devvit KV Store have sufficient capacity for decision history at scale, or do we need Redis via a web service?
- [ ] Can Devvit menu actions be conditionally shown based on mod role (shadow vs senior)?
- [ ] How do we handle posts that are removed by AutoModerator before the senior review completes?

---

## Timeline (12 days remaining as of 2026-05-15)

| Days | Work |
|---|---|
| 1–2 | Community sentiment analysis (r/ModSupport scrape + VADER) to validate pain points |
| 2–3 | Devvit project scaffold, data model, KV store schema |
| 4–6 | Shadow decision form + senior review form |
| 7–8 | Report generation + delivery |
| 9–10 | Analytics dashboard |
| 11 | Polish, install flow, compliance check |
| 12 | Submission: app listing, overview, impact statement |

---

## References

- Discovery & competitive research: `../discovery.md`
- Hackathon details: https://mod-tools-migration.devpost.com/
- Devvit docs: https://developers.reddit.com/docs
- Reddit Training Queue: https://support.reddithelp.com/hc/en-us/articles/46803341406228-Mod-Guide-Training-Queue
- Wattpad sentiment analysis reference: `/Users/titan/Code/wattpad` (`collect.py`, `analyze.py`, `report.py`)
