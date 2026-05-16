import { Hono } from 'hono';
import type { OnModActionRequest, TriggerResponse } from '@devvit/web/shared';
import { getPendingForPost, getReviewerDecisionsForPost } from '../core/decisions.js';
import { scheduleReport } from '../core/reports.js';
import type { ReportJobData } from '../../shared/types.js';

export const triggers = new Hono();

// ModAction trigger — fires on every mod action in the subreddit.
// We use it to detect when a real action is taken on a post that has
// a completed observer+reviewer decision pair, then schedule the report.
triggers.post('/mod-action', async (c) => {
  const body = await c.req.json<OnModActionRequest>();

  // Only care about post actions
  const post = body.targetPost;
  if (!post?.id) {
    return c.json<TriggerResponse>({});
  }

  // context.postId is t3_-prefixed; normalise the proto ID to match
  const postId = post.id.startsWith('t3_') ? post.id : `t3_${post.id}`;

  const pending = await getPendingForPost(postId);
  if (pending.length === 0) {
    return c.json<TriggerResponse>({});
  }

  const reviewers = await getReviewerDecisionsForPost(postId);
  if (reviewers.length === 0) {
    // Real action taken but no reviewer decision recorded — nothing to report
    return c.json<TriggerResponse>({});
  }

  const postTitle     = post.title     ?? `Post ${postId}`;
  const postPermalink = post.permalink ?? `https://reddit.com/comments/${postId}`;
  const finalAction   = body.action    ?? 'unknown';

  // Schedule a report job for each observer with pending_report status
  for (const observer of pending) {
    if (observer.status !== 'pending_report') continue;

    const jobData: ReportJobData = {
      postId,
      observerId: observer.observerId,
      finalAction,
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
