import { Hono } from 'hono';
import {} from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
import { getPendingForPost, getSeniorDecisionsForPost } from '../core/decisions.js';
import { scheduleReport } from '../core/reports.js';
import type { ReportJobData } from '../../shared/types.js';

export const triggers = new Hono();

// ModAction trigger — fires on every mod action in the subreddit.
// We use it to detect when a real action is taken on a post that has
// a completed shadow+senior review pair, then schedule the report.
triggers.post('/mod-action', async (c) => {
  const body = await c.req.json<{
    type: string;
    target?: { id?: string; title?: string; permalink?: string };
    moderatorName?: string;
  }>();

  const targetId = body.target?.id; // e.g. "t3_abc123"
  if (!targetId?.startsWith('t3_')) {
    // Not a post action — ignore
    return c.json<TriggerResponse>({});
  }

  const postId = targetId.slice(3); // strip "t3_" prefix

  const pending = await getPendingForPost(postId);
  if (pending.length === 0) {
    return c.json<TriggerResponse>({});
  }

  const seniors = await getSeniorDecisionsForPost(postId);
  if (seniors.length === 0) {
    // Real action taken but no senior review yet — no report to send
    return c.json<TriggerResponse>({});
  }

  const postTitle     = body.target?.title     ?? `Post ${postId}`;
  const postPermalink = body.target?.permalink ?? `https://reddit.com/comments/${postId}`;

  // Schedule a report job for each shadow mod who has a pending_report status
  for (const shadow of pending) {
    if (shadow.status !== 'pending_report') continue;

    const jobData: ReportJobData = {
      postId,
      shadowModId: shadow.shadowModId,
      finalAction: body.type,
      postTitle,
      postPermalink,
    };

    await scheduleReport(jobData);
  }

  return c.json<TriggerResponse>({});
});

triggers.post('/app-install', async (c) => {
  // Nothing to do on install — configuration happens via the settings menu action
  return c.json<TriggerResponse>({});
});
