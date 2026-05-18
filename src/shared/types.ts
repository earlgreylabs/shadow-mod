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

export type ModActionType = z.infer<typeof ModActionTypeSchema>;
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;
export type ObserverDecision = z.infer<typeof ObserverDecisionSchema>;
export type ReviewerDecision = z.infer<typeof ReviewerDecisionSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type ReportJobData = z.infer<typeof ReportJobDataSchema>;

export const MOD_ACTION_LABELS: Record<ModActionType, string> = {
  approve: 'Approve',
  remove: 'Remove',
  flair: 'Flair',
  warn: 'Warn (modmail)',
  temp_ban: 'Temporary ban',
  perm_ban: 'Permanent ban',
  escalate: 'Escalate to reviewer',
};
