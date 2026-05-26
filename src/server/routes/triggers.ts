import { Hono } from 'hono';
import type { OnModActionRequest, TriggerResponse } from '@devvit/web/shared';
import { getPendingForPost, getReviewerDecisionsForPost } from '../core/decisions.js';
import { scheduleReport } from '../core/reports.js';
import type { ReportJobData } from '@/shared/types.js';

/** Hono sub-app handling Devvit trigger events: onModAction and onAppInstall. */
export const triggers = new Hono();

// Fires on every mod action in the subreddit. Used to detect when a real action
// lands on a post that has a completed Observer+Reviewer pair, then schedule the report.
triggers.post('/mod-action', async (c) => {
  const body = await c.req.json<OnModActionRequest>();

  // Only care about post-level actions
  const post = body.targetPost;
  if (!post?.id) {
    return c.json<TriggerResponse>({});
  }

  // context.postId is t3_-prefixed; normalise the trigger payload ID to match.
  const postId = post.id.startsWith('t3_') ? post.id : `t3_${post.id}`;

  const pending = await getPendingForPost(postId);
  if (pending.length === 0) {
    return c.json<TriggerResponse>({});
  }

  const reviewers = await getReviewerDecisionsForPost(postId);
  if (reviewers.length === 0) {
    // Real action taken but no Reviewer decision recorded — nothing to report yet.
    return c.json<TriggerResponse>({});
  }

  const postTitle = post.title ?? `Post ${postId}`;
  const postPermalink = post.permalink ?? `https://reddit.com/comments/${postId}`;
  const finalAction = body.action ?? 'unknown';

  // Schedule a report job for each Observer that has reached pending_report status.
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
  // Configuration happens via the settings menu action — nothing to initialise on install.
  return c.json<TriggerResponse>({});
});
