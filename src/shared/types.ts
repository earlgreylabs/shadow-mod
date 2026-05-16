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
  escalate:  'Escalate to reviewer',
};

export type DecisionStatus = 'pending_review' | 'pending_report' | 'complete';

export type ObserverDecision = {
  id: string;           // postId:observerId
  postId: string;
  observerId: string;   // t2_ prefixed
  observerName: string;
  action: ModActionType;
  reason: string;
  timestamp: string;    // ISO 8601
  status: DecisionStatus;
};

export type ReviewerDecision = {
  postId: string;
  reviewerId: string;   // t2_ prefixed
  reviewerName: string;
  action: ModActionType;
  reason: string;
  timestamp: string;
};

export type Report = {
  postId: string;
  postTitle: string;
  postPermalink: string;
  observer: ObserverDecision;
  reviewer: ReviewerDecision;
  finalAction: string;  // raw Reddit mod action type
  agreement: boolean;
  generatedAt: string;
};

export type AppConfig = {
  reviewers: string[];  // Reddit usernames (no t2_ prefix)
};

// Payload carried through the scheduler job
export type ReportJobData = {
  postId: string;
  observerId: string;
  finalAction: string;
  postTitle: string;
  postPermalink: string;
};
