# ShadowMod — Hackathon Submission

**Hackathon:** Reddit Mod Tools and Migrated Apps Hackathon
**Deadline:** 2026-05-27 @ 6:00 PM PDT
**Category:** Best New Mod Tool
**Platform:** Devvit (Reddit Developer Platform)

---

## Problem

New moderators learn by doing, which means their early mistakes happen on live content in front of
real community members. There is no low-stakes environment where they can practise the full range
of moderation decisions (approve, remove, flair, warn, ban, escalate) and receive structured
feedback on their judgment compared to an experienced mod.

Reddit's current Training Queue is a step in the right direction, focused on approve/remove
practice with immediate per-post feedback. There does not appear to be a built-in structured
workflow for practising the full range of mod actions, capturing reasoning, or running a blind
parallel Review by an experienced mod for longitudinal comparison.

The result: new mods either get unsupervised access too early, or experienced mods spend
disproportionate time hand-holding without a scalable feedback mechanism.

---

## Solution: ShadowMod

ShadowMod is a Devvit app that creates a structured Observer/Reviewer moderation workflow:

1. The **Observer** encounters a post in the queue and records their decision plus reasoning. The
   action is not executed.
2. The **Reviewer** independently records their own decision plus reasoning on the same post,
   without seeing the Observer's call first (blind Review).
3. The post is actioned in the live queue as normal.
4. The Observer receives a **Comparison report**: their Observation vs the Reviewer's Review vs
   the final Outcome, with reasoning from both sides.
5. Over time, Observers can review their **stats**: decision accuracy and agreement rate across
   all completed Observations.

---

## Core Flow

```txt
Observer opens a post from the mod queue
        │
        ▼
Selects "Record observation" from the post mod menu
Records: action + reason (NOT executed against the post)
        │
        ▼
Reviewer opens "Review queue" from the subreddit mod menu
Selects a post with pending Observations
Navigates to the post, then selects "Record review"
Records: action + reason (blind to the Observer's call)
        │
        ▼
Any mod (or AutoModerator) takes the real action on the post
onModAction trigger fires
        │
        ▼
generate-report job scheduled and executed
        │
        ▼
Comparison report delivered to the Observer via modmail
(mod note fallback if modmail is unavailable)
Observer stats updated (total, correct, wrong)
```

---

## Key Design Decisions

### Blind Review

The Reviewer records their decision before seeing the Observer's call. This eliminates anchoring
bias: the feedback is genuinely comparative, not a rationalisation of what the Observer said.

### Full decision vocabulary

Unlike the native Training Queue, ShadowMod supports the full mod action set: approve, remove
(with reason), flair, warn, temp ban, permanent ban, escalate, and any custom actions the
subreddit configures.

### Async, not immediate

Feedback is delivered after the real mod action lands, not immediately after the Observation.
This more closely mirrors real moderation flow and prevents Observers from gaming the system for
instant validation.

### Pull-based Reviewer workflow

Rather than push notifications (not reliably available in Devvit), Reviewers discover pending
Observations via the "Review queue" subreddit menu action. The queue shows post titles and
Observer names so Reviewers can triage without opening each post individually.

### Community-configurable reviewers

Each subreddit configures its own Reviewer list via the "ShadowMod settings" menu action.
Observer vs Reviewer role assignment is stored in Redis and checked server-side on every request.

---

## Technical Architecture

**Platform:** Devvit (TypeScript)

### Components

| Component         | Devvit primitive            | Purpose                                                 |
| ----------------- | --------------------------- | ------------------------------------------------------- |
| Observation form  | Post-level menu action      | Observer captures decision plus reasoning               |
| Review form       | Post-level menu action      | Reviewer records decision before seeing the Observation |
| Review queue      | Subreddit-level menu action | Reviewer browses posts with pending Observations        |
| Comparison report | Modmail / mod note fallback | Structured report delivered to the Observer             |
| Observer stats    | Subreddit-level menu action | Accuracy totals across all completed Observations       |
| Settings          | Subreddit-level menu action | Reviewer username list, per subreddit                   |

### Data model (key entities)

```txt
Observation
  id, postId
  observerId, observerName, action, reason, timestamp
  status: pending_review | pending_report | complete

Review
  postId
  reviewerId, reviewerName, action, reason, timestamp

Report (in-memory, delivered via modmail)
  postId, postTitle, postPermalink
  observer (Observation), reviewer (Review)
  finalAction, agreement, generatedAt
```

### Storage

Devvit Redis (namespaced per subreddit install). Key patterns:

| Key pattern                         | Contents                       |
| ----------------------------------- | ------------------------------ |
| `observer:{postId}:{observerId}`    | serialised Observation         |
| `reviewer:{postId}:{reviewerId}`    | serialised Review              |
| `pending` (sorted set)              | postIds with open Observations |
| `reviewers_set` (sorted set)        | postIds with recorded Reviews  |
| `config:reviewers` (via config key) | Reviewer usernames             |
| `stats:{userId}`                    | Observer accuracy totals       |

### Report delivery

Reports are sent to the Observer as a Reddit private message (modmail). If modmail is unavailable
at delivery time, ShadowMod falls back to a mod note on the Observer's profile in the subreddit.

---

## Submission Fit

| Judging criterion     | ShadowMod                                                                             |
| --------------------- | ------------------------------------------------------------------------------------- |
| Community Impact      | Reduces bad early-mod decisions, scales Reviewer mentorship, improves community trust |
| Polish and compliance | Devvit-native install, standard mod queue integration, no external dependencies       |
| Reliable UX           | One-click install, no config required to start, Reviewer assignment via settings menu |
| Ecosystem Impact      | Applicable to any subreddit with a tiered mod structure                               |

---

## Differentiation from Reddit Training Queue

Reddit's native Training Queue validates the problem space. ShadowMod goes further in five
specific ways (see `../hackathon/discovery.md` for the full comparison table).

---

## Out of Scope (v1)

- AI-assisted decision suggestions (avoid adding noise to the training signal)
- Cross-subreddit analytics
- Integration with external moderation tooling (Toolbox, etc.)
- Push notifications to Reviewers (not reliably available in Devvit; replaced with queue UI)

---

## Open Questions

- [ ] Observation cleanup: if a real mod action is taken before any Reviewer records a Review,
      the Observation stays in `pending_review` indefinitely. No expiry or cleanup is implemented in
      v1. The trigger no-ops cleanly, but stale entries accumulate in the pending set.
- [ ] Scale ceiling: the pending set `zScan` uses a page size of 1000. Subreddits with high post
      volume and many active Observers may need pagination across multiple cursor pages.

---

## Timeline

| Days | Work                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| 1-2  | Community sentiment analysis (r/ModSupport scrape + VADER) to validate pain points |
| 2-3  | Devvit project scaffold, Redis schema, core data model                             |
| 4-6  | Observation form and Review form                                                   |
| 7-8  | Report generation and modmail delivery                                             |
| 9-10 | Observer stats, Review queue, settings persistence                                 |
| 11   | Polish, duplicate guard, navigate-to-post flow, compliance check                   |
| 12   | Submission: app listing, overview, impact statement                                |

---

## References

- Discovery and competitive research: `../hackathon/discovery.md`
- Hackathon details: https://mod-tools-migration.devpost.com/
- Devvit docs: https://developers.reddit.com/docs
- Reddit Training Queue: https://support.reddithelp.com/hc/en-us/articles/46803341406228-Mod-Guide-Training-Queue
