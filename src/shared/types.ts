// Types are inferred from Zod schemas in `schemas.ts` — that file is the single
// source of truth for runtime + compile-time shape. Add fields there, not here.

import type { z } from 'zod';
import type {
  ModActionTypeSchema,
  DecisionStatusSchema,
  ObserverDecisionSchema,
  ReviewerDecisionSchema,
  ReportSchema,
  AppConfigSchema,
  ReportJobDataSchema,
} from './schemas.js';

/** All mod actions an Observer or Reviewer can record against a queued post. */
export type ModActionType = z.infer<typeof ModActionTypeSchema>;

/** Lifecycle stage of an ObserverDecision from recording to report delivery. */
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

/** An Observer's recorded decision — stored but not executed against the post. */
export type ObserverDecision = z.infer<typeof ObserverDecisionSchema>;

/** A Reviewer's independent decision, recorded blind to the Observer's call. */
export type ReviewerDecision = z.infer<typeof ReviewerDecisionSchema>;

/** Comparison report delivered to the Observer after the real mod action is detected. */
export type Report = z.infer<typeof ReportSchema>;

/** Per-subreddit ShadowMod configuration. */
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** Payload for the `generate-report` scheduler job. */
export type ReportJobData = z.infer<typeof ReportJobDataSchema>;

/**
 * Human-readable display labels for each mod action type.
 * Used in form select options and Comparison report formatting.
 */
export const MOD_ACTION_LABELS: Record<ModActionType, string> = {
  approve: 'Approve',
  remove: 'Remove',
  flair: 'Flair',
  warn: 'Warn (modmail)',
  temp_ban: 'Temporary ban',
  perm_ban: 'Permanent ban',
  escalate: 'Escalate to reviewer',
};
