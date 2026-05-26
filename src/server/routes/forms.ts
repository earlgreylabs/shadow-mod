import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import type { ModActionType } from '@/shared/types.js';
import {
  saveObserverDecision,
  saveReviewerDecision,
  getPendingForPost,
  updateObserverStatus,
  getFormSession,
  hasObserverDecision,
} from '../core/decisions.js';
import { setConfig } from '../core/config.js';

/** Hono sub-app handling all form submission endpoints. */
export const forms = new Hono();

// Devvit sends form fields as a flat root object — no `values` wrapper.
// Select fields arrive as string[], paragraph/string fields as plain string.

forms.post('/observation-submit', async (c) => {
  const userId = context.userId;
  const body = await c.req.json<{ action?: string | string[]; reason?: string }>();

  if (!userId) {
    return c.json<UiResponse>({ showToast: 'Session error: please try again.' });
  }

  // Devvit does not forward the devvit-post header to form submission requests,
  // so postId may be absent from context. Fall back to the session stored by the menu handler.
  const session = await getFormSession(userId);
  const postId = context.postId ?? session?.postId;
  const username = context.username ?? session?.username;

  if (!postId || !username) {
    return c.json<UiResponse>({ showToast: 'Session error: please try again.' });
  }

  const action = (Array.isArray(body.action) ? body.action[0] : body.action) as ModActionType;
  const reason = body.reason?.trim();

  if (!action || !reason) {
    return c.json<UiResponse>({ showToast: 'Action and reasoning are both required.' });
  }

  if (await hasObserverDecision(postId, userId)) {
    return c.json<UiResponse>({
      showToast: 'You have already recorded an observation on this post.',
    });
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
    showToast: {
      text: 'Observation recorded. A Reviewer will assess it shortly.',
      appearance: 'success',
    },
  });
});

forms.post('/review-submit', async (c) => {
  const userId = context.userId;
  const body = await c.req.json<{ action?: string | string[]; reason?: string }>();

  if (!userId) {
    return c.json<UiResponse>({ showToast: 'Session error: please try again.' });
  }

  // Devvit does not forward the devvit-post header to form submission requests.
  const session = await getFormSession(userId);
  const postId = context.postId ?? session?.postId;
  const username = context.username ?? session?.username;

  if (!postId || !username) {
    return c.json<UiResponse>({ showToast: 'Session error: please try again.' });
  }

  const action = (Array.isArray(body.action) ? body.action[0] : body.action) as ModActionType;
  const reason = body.reason?.trim();

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

forms.post('/queue-submit', async (c) => {
  const userId = context.userId;
  const body = await c.req.json<{ postId?: string | string[] }>();

  if (!userId) {
    return c.json<UiResponse>({ showToast: 'Session error: please try again.' });
  }

  const selectedPostId = Array.isArray(body.postId) ? body.postId[0] : body.postId;

  if (!selectedPostId) {
    return c.json<UiResponse>({ showToast: 'Please select a post from the queue.' });
  }

  // Navigate the Reviewer to the post so they can read it in context,
  // then use "Record review" from the post's mod menu.
  return c.json<UiResponse>({
    navigateTo: `https://www.reddit.com/r/${context.subredditName}/comments/${selectedPostId.replace(/^t3_/, '')}/`,
  });
});

forms.post('/stats-submit', async (c) => {
  // Read-only form — no action on submit
  return c.json<UiResponse>({});
});

forms.post('/settings-submit', async (c) => {
  const body = await c.req.json<{ reviewers?: string }>();
  const raw = body?.reviewers ?? '';

  const reviewers = raw
    .split(',')
    .map((s) => s.trim().replace(/^u\//i, ''))
    .filter(Boolean);

  await setConfig({ reviewers });

  return c.json<UiResponse>({
    showToast: {
      text: `Saved. Reviewers: ${reviewers.length > 0 ? reviewers.join(', ') : 'none set'}`,
      appearance: 'success',
    },
  });
});
