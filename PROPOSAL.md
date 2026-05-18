# ShadowMod, Project Proposal

**Hackathon:** Reddit Mod Tools and Migrated Apps Hackathon
**Deadline:** 2026-05-27 @ 6:00 PM PDT
**Category:** Best New Mod Tool
**Platform:** Devvit (Reddit Developer Platform)

---

## Problem

New moderators learn by doing, which means their early mistakes happen on live content in front of real community members. There is no low-stakes environment where they can practise the full range of moderation decisions (approve, remove, flair, warn, ban, escalate) and receive structured feedback on their judgment compared to an experienced mod.

Reddit's current Training Queue is a step in the right direction, focused on approve/remove practice with immediate per-post feedback. There does not appear to be a built-in structured workflow for practising the full range of mod actions, capturing reasoning, or running a blind parallel Review by an experienced mod for longitudinal comparison.

The result: new mods either get unsupervised access too early, or experienced mods spend disproportionate time hand-holding without a scalable feedback mechanism.

---

## Solution: ShadowMod

ShadowMod is a Devvit app that creates a structured Observer/Reviewer moderation workflow:

1. The **Observer** encounters a post in the queue and records their decision plus reasoning. The action is not executed.
2. The **Reviewer** independently records their own decision plus reasoning on the same post, without seeing the Observer's call first (blind Review).
3. The post is actioned in the live queue as normal.
4. Both mods receive a **comparison report**: Observation vs Review vs final Outcome, with reasoning from both sides.
5. Over time, the Observer and their Reviewer can review **analytics**: decision accuracy, consistency trends, content types where they diverge from the Reviewer's judgment.

---

## Core Flow

```txt
Observer views post
        │
        ▼
Records: action + reason (not executed)
        │
        ▼
ShadowMod notifies assigned Reviewer
        │
        ▼
Reviewer records: action + reason (blind to Observation)
        │
        ▼
Reviewer (or AutoModerator) takes real action
        │
        ▼
Report generated: Observation vs Review vs Outcome
        │
        ├── Sent to Observer (learning feedback)
        └── Logged to analytics dashboard
```

---

## Key Design Decisions

### Blind Review

The Reviewer records their decision before seeing the Observer's call. This eliminates anchoring bias: the feedback is genuinely comparative, not a rationalisation of what the Observer said.

### Full decision vocabulary

Unlike the native Training Queue, ShadowMod supports the full mod action set: approve, remove (with reason), flair, warn, temp ban, permanent ban, escalate, and any custom actions the subreddit configures.

### Async, not immediate

Feedback is delivered after the Reviewer has recorded their Review, not immediately after the Observation. This more closely mirrors real moderation flow and prevents Observers from gaming the system for instant validation.

### Community-configurable rubrics

Each subreddit can define what counts as a "correct" decision for their norms. A political subreddit and a support community have different standards; ShadowMod adapts to both.

---

## Technical Architecture

**Platform:** Devvit (TypeScript)

### Components

| Component           | Devvit primitive            | Purpose                                                  |
| ------------------- | --------------------------- | -------------------------------------------------------- |
| Observation form    | Custom post / menu action   | Observer captures decision plus reasoning                |
| Review form         | Custom post / menu action   | Reviewer records decision before seeing the Observation  |
| Report post         | Custom post type            | Structured comparison delivered to both parties          |
| Analytics dashboard | Custom post type (mod-only) | Longitudinal metrics per Observer                        |
| Config panel        | App settings                | Subreddit-specific decision types, Reviewer assignments  |

### Data model (key entities)

```txt
Observation
  id, postId, subredditId
  observerId, action, reason, timestamp
  status: pending_review | complete

Review
  id, observationId
  reviewerId, action, reason, timestamp

Report
  id, observationId
  observerAction, observerReason
  reviewerAction, reviewerReason
  finalAction
  agreement: boolean
  createdAt
```

### Storage

Devvit KV Store for decision records. Mod log for audit trail.

### Notifications

Devvit's realtime / scheduled jobs to notify Reviewers of pending Observations and deliver reports to Observers.

---

## Submission Fit

| Judging criterion   | ShadowMod                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Community Impact    | Reduces bad early-mod decisions, scales Reviewer mentorship, improves community trust      |
| Polish & compliance | Devvit-native install, standard mod queue integration, no external dependencies            |
| Reliable UX         | One-click install, no config required to start, Reviewer assignment via app settings       |
| Ecosystem Impact    | Applicable to any subreddit with a tiered mod structure                                    |

---

## Differentiation from Reddit Training Queue

Reddit's native Training Queue validates the problem space. ShadowMod goes further in five specific ways (see `../discovery.md` for the full comparison table).

---

## Out of Scope (v1)

- AI-assisted decision suggestions (avoid adding noise to training signal)
- Cross-subreddit analytics
- Integration with external moderation tooling (Toolbox, etc.)

---

## Open Questions

- [ ] Does Devvit KV Store have sufficient capacity for decision history at scale, or do we need Redis via a web service?
- [ ] Can Devvit menu actions be conditionally shown based on mod role (Observer vs Reviewer)?
- [ ] How do we handle posts that are removed by AutoModerator before the Review completes?

---

## Timeline (12 days remaining as of 2026-05-15)

| Days | Work                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| 1-2  | Community sentiment analysis (r/ModSupport scrape + VADER) to validate pain points |
| 2-3  | Devvit project scaffold, data model, KV store schema                               |
| 4-6  | Observation form plus Review form                                                  |
| 7-8  | Report generation and delivery                                                     |
| 9-10 | Analytics dashboard                                                                |
| 11   | Polish, install flow, compliance check                                             |
| 12   | Submission: app listing, overview, impact statement                                |

---

## References

- Discovery and competitive research: `../discovery.md`
- Hackathon details: https://mod-tools-migration.devpost.com/
- Devvit docs: https://developers.reddit.com/docs
- Reddit Training Queue: https://support.reddithelp.com/hc/en-us/articles/46803341406228-Mod-Guide-Training-Queue
- Wattpad sentiment analysis reference: `/Users/titan/Code/wattpad` (`collect.py`, `analyze.py`, `report.py`)
