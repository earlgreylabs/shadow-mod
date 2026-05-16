import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import { hasObserverDecision, getPendingForPost, getStats } from '../core/decisions.js';
import { isReviewer, getConfig } from '../core/config.js';
import { MOD_ACTION_LABELS } from '../../shared/types.js';

export const menu = new Hono();

const ACTION_OPTIONS = Object.entries(MOD_ACTION_LABELS).map(([value, label]) => ({
  label,
  value,
}));

menu.post('/shadow-decision', async (c) => {
  const { postId, userId, username } = context;

  if (!postId || !userId || !username) {
    return c.json<UiResponse>({ showToast: 'Could not identify post or user.' });
  }

  if (await isReviewer(username)) {
    return c.json<UiResponse>({
      showToast: 'Reviewers use "Review shadow decision" instead.',
    });
  }

  if (await hasObserverDecision(postId, userId)) {
    return c.json<UiResponse>({
      showToast: 'You already have a pending shadow decision for this post.',
    });
  }

  return c.json<UiResponse>({
    showForm: {
      name: 'shadowDecisionForm',
      form: {
        title: 'Record shadow decision',
        description: 'What would you do with this post? Your decision is recorded but NOT executed.',
        fields: [
          {
            name: 'action',
            label: 'Action',
            type: 'select',
            options: ACTION_OPTIONS,
            required: true,
          },
          {
            name: 'reason',
            label: 'Reasoning',
            type: 'paragraph',
            placeholder: 'Explain why you chose this action...',
            required: true,
          },
        ],
        acceptLabel: 'Submit decision',
      },
    },
  });
});

menu.post('/senior-review', async (c) => {
  const { postId, username } = context;

  if (!postId || !username) {
    return c.json<UiResponse>({ showToast: 'Could not identify post or user.' });
  }

  if (!(await isReviewer(username))) {
    return c.json<UiResponse>({
      showToast: 'Only reviewers can do this. Ask your admin to add you in ShadowMod settings.',
    });
  }

  const allPending = await getPendingForPost(postId);
  const pending = allPending.filter(d => d.status === 'pending_review');
  if (pending.length === 0) {
    return c.json<UiResponse>({
      showToast: 'No pending shadow decisions for this post.',
    });
  }

  const observerNames = pending.map(d => d.observerName).join(', ');

  return c.json<UiResponse>({
    showForm: {
      name: 'seniorReviewForm',
      form: {
        title: 'Review shadow decision',
        description: `Pending from: ${observerNames}. Record your independent decision before taking real action.`,
        fields: [
          {
            name: 'action',
            label: 'Your action',
            type: 'select',
            options: ACTION_OPTIONS,
            required: true,
          },
          {
            name: 'reason',
            label: 'Reasoning',
            type: 'paragraph',
            placeholder: 'Explain your decision...',
            required: true,
          },
        ],
        acceptLabel: 'Submit review',
      },
    },
  });
});

menu.post('/stats', async (c) => {
  const { userId, username } = context;

  if (!userId || !username) {
    return c.json<UiResponse>({ showToast: 'Could not identify user.' });
  }

  const raw = await getStats(userId);
  const total   = Number.parseInt(raw['total']   ?? '0', 10);
  const correct = Number.parseInt(raw['correct'] ?? '0', 10);
  const wrong   = Number.parseInt(raw['wrong']   ?? '0', 10);

  if (total === 0) {
    return c.json<UiResponse>({
      showToast: 'No completed shadow decisions yet. Use "Record shadow decision" on a post to start.',
    });
  }

  const accuracy = `${((correct / total) * 100).toFixed(1)}%`;

  return c.json<UiResponse>({
    showForm: {
      name: 'statsForm',
      form: {
        title: `ShadowMod — u/${username}`,
        description: 'Your shadow decision accuracy across all completed reviews.',
        fields: [
          { name: 'total',    label: 'Total completed',  type: 'string', defaultValue: String(total),   disabled: true, required: false },
          { name: 'correct',  label: 'Matched reviewer', type: 'string', defaultValue: String(correct), disabled: true, required: false },
          { name: 'wrong',    label: 'Diverged',         type: 'string', defaultValue: String(wrong),   disabled: true, required: false },
          { name: 'accuracy', label: 'Accuracy',         type: 'string', defaultValue: accuracy,         disabled: true, required: false },
        ],
        acceptLabel: 'Done',
        cancelLabel: 'Close',
      },
    },
  });
});

menu.post('/settings', async (c) => {
  const config = await getConfig();

  return c.json<UiResponse>({
    showForm: {
      name: 'settingsForm',
      form: {
        title: 'ShadowMod settings',
        description: 'Comma-separated list of Reddit usernames who act as reviewers for this subreddit.',
        fields: [
          {
            name: 'reviewers',
            label: 'Reviewer usernames',
            type: 'string',
            placeholder: 'e.g. username1, username2',
            defaultValue: config.reviewers.join(', '),
            required: false,
          },
        ],
        acceptLabel: 'Save',
      },
    },
  });
});
