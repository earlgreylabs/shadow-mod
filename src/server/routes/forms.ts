import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import type { ModActionType } from '../../shared/types.js';
import {
  saveObserverDecision,
  saveReviewerDecision,
  getPendingForPost,
  updateObserverStatus,
} from '../core/decisions.js';
import { setConfig } from '../core/config.js';

export const forms = new Hono();

forms.post('/shadow-decision-submit', async (c) => {
  // SelectField value comes back as string[] even for single-select
  const body = await c.req.json<{ values: { action: string[]; reason: string } }>();
  const { postId, userId, username } = context;

  if (!postId || !userId || !username) {
    return c.json<UiResponse>({ showToast: 'Session error — please try again.' });
  }

  const action = body.values.action[0] as ModActionType;
  const reason = body.values.reason?.trim();

  if (!action || !reason) {
    return c.json<UiResponse>({ showToast: 'Action and reasoning are both required.' });
  }

  await saveObserverDecision({
    id: `${postId}:${userId}`,
    postId,
    observerId: userId,
    observerName: username,
    action,
    reason,
    timestamp: new Date().toISOString(),
    status: 'pending_review',
  });

  return c.json<UiResponse>({
    showToast: { text: 'Shadow decision recorded. A reviewer will assess it shortly.', appearance: 'success' },
  });
});

forms.post('/senior-review-submit', async (c) => {
  const body = await c.req.json<{ values: { action: string[]; reason: string } }>();
  const { postId, userId, username } = context;

  if (!postId || !userId || !username) {
    return c.json<UiResponse>({ showToast: 'Session error — please try again.' });
  }

  const action = body.values.action[0] as ModActionType;
  const reason = body.values.reason?.trim();

  if (!action || !reason) {
    return c.json<UiResponse>({ showToast: 'Action and reasoning are both required.' });
  }

  await saveReviewerDecision({
    postId,
    reviewerId: userId,
    reviewerName: username,
    action,
    reason,
    timestamp: new Date().toISOString(),
  });

  // Move all pending observer decisions for this post to pending_report
  const pending = await getPendingForPost(postId);
  for (const d of pending) {
    await updateObserverStatus(postId, d.observerId, 'pending_report');
  }

  return c.json<UiResponse>({
    showToast: {
      text: 'Your review is recorded. Reports will be sent when the real action is taken.',
      appearance: 'success',
    },
  });
});

forms.post('/stats-submit', async (c) => {
  // Read-only form — no action on submit
  return c.json<UiResponse>({});
});

forms.post('/settings-submit', async (c) => {
  const body = await c.req.json<{ values: { reviewers: string } }>();
  const raw = body.values.reviewers ?? '';

  const reviewers = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  await setConfig({ reviewers });

  return c.json<UiResponse>({
    showToast: {
      text: `Saved. Reviewers: ${reviewers.length > 0 ? reviewers.join(', ') : 'none set'}`,
      appearance: 'success',
    },
  });
});
