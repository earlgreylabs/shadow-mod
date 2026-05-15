import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import type { ModActionType } from '../../shared/types.js';
import {
  saveShadowDecision,
  saveSeniorDecision,
  getPendingForPost,
  updateShadowStatus,
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

  await saveShadowDecision({
    id: `${postId}:${userId}`,
    postId,
    shadowModId: userId,
    shadowModName: username,
    action,
    reason,
    timestamp: new Date().toISOString(),
    status: 'pending_senior',
  });

  return c.json<UiResponse>({
    showToast: { text: 'Shadow decision recorded. A senior mod will review shortly.', appearance: 'success' },
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

  await saveSeniorDecision({
    postId,
    seniorModId: userId,
    seniorModName: username,
    action,
    reason,
    timestamp: new Date().toISOString(),
  });

  // Move all pending shadow decisions for this post to pending_report
  const pending = await getPendingForPost(postId);
  for (const d of pending) {
    await updateShadowStatus(postId, d.shadowModId, 'pending_report');
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
  const body = await c.req.json<{ values: { seniorMods: string } }>();
  const raw = body.values.seniorMods ?? '';

  const seniorMods = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  await setConfig({ seniorMods });

  return c.json<UiResponse>({
    showToast: {
      text: `Saved. Senior mods: ${seniorMods.length > 0 ? seniorMods.join(', ') : 'none set'}`,
      appearance: 'success',
    },
  });
});
