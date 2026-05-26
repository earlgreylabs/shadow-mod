// Single source of truth for runtime-validated shapes.
// types.ts re-exports z.infer<> aliases — adding/removing a field here flows automatically
// to the static type. Do not declare these shapes elsewhere.

import { z } from 'zod';

/**
 * All mod actions an Observer or Reviewer can record against a queued post.
 * Mirrors the full range of real Reddit mod actions, not just approve/remove.
 */
export const ModActionTypeSchema = z.enum([
  'approve',
  'remove',
  'flair',
  'warn',
  'temp_ban',
  'perm_ban',
  'escalate',
]);

/**
 * Lifecycle of an ObserverDecision from recording to report delivery.
 *
 * - `pending_review`: recorded, waiting for a Reviewer to weigh in.
 * - `pending_report`: Reviewer has recorded their decision; waiting for the real mod action.
 * - `complete`: Comparison report generated and delivered to the Observer.
 */
export const DecisionStatusSchema = z.enum(['pending_review', 'pending_report', 'complete']);

/**
 * An Observer's recorded decision on a queued post.
 * The chosen action is stored but never executed against the post.
 */
export const ObserverDecisionSchema = z.object({
  id: z.string(),
  postId: z.string(),
  observerId: z.string(),
  observerName: z.string(),
  action: ModActionTypeSchema,
  reason: z.string(),
  timestamp: z.string(),
  status: DecisionStatusSchema,
});

/**
 * A Reviewer's independent decision on a post.
 * Recorded blind to the Observer's call to prevent anchoring bias.
 */
export const ReviewerDecisionSchema = z.object({
  postId: z.string(),
  reviewerId: z.string(),
  reviewerName: z.string(),
  action: ModActionTypeSchema,
  reason: z.string(),
  timestamp: z.string(),
});

/**
 * A Comparison report comparing Observer decision, Reviewer decision, and final Outcome.
 * Delivered to the Observer via modmail after the real mod action is detected.
 */
export const ReportSchema = z.object({
  postId: z.string(),
  postTitle: z.string(),
  postPermalink: z.string(),
  observer: ObserverDecisionSchema,
  reviewer: ReviewerDecisionSchema,
  finalAction: z.string(),
  agreement: z.boolean(),
  generatedAt: z.string(),
});

/**
 * Per-subreddit ShadowMod configuration persisted in Redis.
 */
export const AppConfigSchema = z.object({
  reviewers: z.array(z.string()),
});

/**
 * Payload attached to a `generate-report` scheduler job.
 * Carries enough context to build the Comparison report without additional lookups.
 */
export const ReportJobDataSchema = z.object({
  postId: z.string(),
  observerId: z.string(),
  finalAction: z.string(),
  postTitle: z.string(),
  postPermalink: z.string(),
});
