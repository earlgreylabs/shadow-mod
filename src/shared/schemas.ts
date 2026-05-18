// Single source of truth for runtime-validated shapes.
// types.ts re-exports z.infer<> aliases of these schemas — option (b) from the
// guardrails plan — so adding/removing a field in a schema flows automatically
// to the static type. Do not declare these shapes elsewhere.

import { z } from 'zod';

export const ModActionTypeSchema = z.enum([
  'approve',
  'remove',
  'flair',
  'warn',
  'temp_ban',
  'perm_ban',
  'escalate',
]);

export const DecisionStatusSchema = z.enum(['pending_review', 'pending_report', 'complete']);

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

export const ReviewerDecisionSchema = z.object({
  postId: z.string(),
  reviewerId: z.string(),
  reviewerName: z.string(),
  action: ModActionTypeSchema,
  reason: z.string(),
  timestamp: z.string(),
});

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

export const AppConfigSchema = z.object({
  reviewers: z.array(z.string()),
});

export const ReportJobDataSchema = z.object({
  postId: z.string(),
  observerId: z.string(),
  finalAction: z.string(),
  postTitle: z.string(),
  postPermalink: z.string(),
});
