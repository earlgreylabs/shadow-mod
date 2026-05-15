export type ModActionType =
  | 'approve'
  | 'remove'
  | 'flair'
  | 'warn'
  | 'temp_ban'
  | 'perm_ban'
  | 'escalate';

export const MOD_ACTION_LABELS: Record<ModActionType, string> = {
  approve:   'Approve',
  remove:    'Remove',
  flair:     'Flair',
  warn:      'Warn (modmail)',
  temp_ban:  'Temporary ban',
  perm_ban:  'Permanent ban',
  escalate:  'Escalate to senior mod',
};

export type DecisionStatus = 'pending_senior' | 'pending_report' | 'complete';

export type ShadowDecision = {
  id: string;             // postId:shadowModId
  postId: string;
  shadowModId: string;    // t2_ prefixed
  shadowModName: string;
  action: ModActionType;
  reason: string;
  timestamp: string;      // ISO 8601
  status: DecisionStatus;
};

export type SeniorDecision = {
  postId: string;
  seniorModId: string;    // t2_ prefixed
  seniorModName: string;
  action: ModActionType;
  reason: string;
  timestamp: string;
};

export type Report = {
  postId: string;
  postTitle: string;
  postPermalink: string;
  shadow: ShadowDecision;
  senior: SeniorDecision;
  finalAction: string;    // raw Reddit mod action type
  agreement: boolean;
  generatedAt: string;
};

export type AppConfig = {
  seniorMods: string[];   // Reddit usernames (no t2_ prefix)
};

// Payload carried through the scheduler job
export type ReportJobData = {
  postId: string;
  shadowModId: string;
  finalAction: string;
  postTitle: string;
  postPermalink: string;
};
