import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import {
  hasObserverDecision,
  getPendingForPost,
  getAllPending,
  getStats,
  storeFormSession,
} from '../core/decisions.js';
import { isReviewer, getConfig } from '../core/config.js';
import { MOD_ACTION_LABELS } from '@/shared/types.js';

/** Hono sub-app handling all menu action endpoints: observation, review, queue, stats, settings. */
export const menu = new Hono();

const TITLE_MAX_LEN = 60;

// Truncates to TITLE_MAX_LEN characters to keep queue labels readable in Devvit's narrow UI.
function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_LEN) return title;
  return `${title.slice(0, TITLE_MAX_LEN)}...`;
}

const ACTION_OPTIONS = Object.entries(MOD_ACTION_LABELS).map(([value, label]) => ({
  label,
  value,
}));

menu.post('/observation', async (c) => {
  const { postId, userId, username } = context;

  if (!postId || !userId || !username) {
    return c.json<UiResponse>({ showToast: 'Could not identify post or user.' });
  }

  if (await isReviewer(username)) {
    return c.json<UiResponse>({
      showToast: 'Reviewers use "Record review" instead.',
    });
  }

  if (await hasObserverDecision(postId, userId)) {
    return c.json<UiResponse>({
      showToast: 'You already have a pending observation for this post.',
    });
  }

  await storeFormSession({ postId, userId, username });

  return c.json<UiResponse>({
    showForm: {
      name: 'observationForm',
      form: {
        title: 'Record observation',
        description:
          'What would you do with this post? Your decision is recorded but NOT executed.',
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

menu.post('/review', async (c) => {
  const { postId, userId, username } = context;

  if (!postId || !userId || !username) {
    return c.json<UiResponse>({ showToast: 'Could not identify post or user.' });
  }

  if (!(await isReviewer(username))) {
    return c.json<UiResponse>({
      showToast: 'Only Reviewers can do this. Ask your admin to add you in ShadowMod settings.',
    });
  }

  const allPending = await getPendingForPost(postId);
  const pending = allPending.filter((d) => d.status === 'pending_review');
  if (pending.length === 0) {
    return c.json<UiResponse>({
      showToast: 'No pending observations for this post.',
    });
  }

  const observerNames = pending.map((d) => d.observerName).join(', ');
  await storeFormSession({ postId, userId, username });

  return c.json<UiResponse>({
    showForm: {
      name: 'reviewForm',
      form: {
        title: 'Record review',
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

menu.post('/queue', async (c) => {
  const { userId, username } = context;

  if (!userId || !username) {
    return c.json<UiResponse>({ showToast: 'Could not identify user.' });
  }

  if (!(await isReviewer(username))) {
    return c.json<UiResponse>({
      showToast:
        'Only Reviewers can access the review queue. Ask your admin to add you in ShadowMod settings.',
    });
  }

  const pending = await getAllPending();

  if (pending.length === 0) {
    return c.json<UiResponse>({ showToast: 'No posts are waiting for review.' });
  }

  const selectOptions = await Promise.all(
    pending.map(async ({ postId, observerNames }) => {
      let displayTitle = postId;
      try {
        const prefixedId = (postId.startsWith('t3_') ? postId : `t3_${postId}`) as `t3_${string}`;
        const post = await reddit.getPostById(prefixedId);
        displayTitle = truncateTitle(post.title);
      } catch {
        // Fall back to postId if the fetch fails
      }
      return {
        label: `${displayTitle} — observed by: ${observerNames.join(', ')}`,
        value: postId,
      };
    }),
  );

  await storeFormSession({ postId: pending[0].postId, userId, username });

  return c.json<UiResponse>({
    showForm: {
      name: 'queueForm',
      form: {
        title: 'Review queue',
        description: `${pending.length} post${pending.length === 1 ? '' : 's'} waiting for review. Select one to go to the post, then use "Record review" from the mod menu.`,
        fields: [
          {
            name: 'postId',
            label: 'Post',
            type: 'select',
            options: selectOptions,
            required: true,
          },
        ],
        acceptLabel: 'Go to post',
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
  const total = Number.parseInt(raw['total'] ?? '0', 10);
  const correct = Number.parseInt(raw['correct'] ?? '0', 10);
  const wrong = Number.parseInt(raw['wrong'] ?? '0', 10);

  if (total === 0) {
    return c.json<UiResponse>({
      showToast: 'No completed observations yet. Use "Record observation" on a post to start.',
    });
  }

  const accuracy = `${((correct / total) * 100).toFixed(1)}%`;

  return c.json<UiResponse>({
    showForm: {
      name: 'statsForm',
      form: {
        title: `ShadowMod: u/${username}`,
        description: 'Your observation accuracy across all completed reviews.',
        fields: [
          {
            name: 'total',
            label: 'Total completed',
            type: 'string',
            defaultValue: String(total),
            disabled: true,
            required: false,
          },
          {
            name: 'correct',
            label: 'Matched reviewer',
            type: 'string',
            defaultValue: String(correct),
            disabled: true,
            required: false,
          },
          {
            name: 'wrong',
            label: 'Diverged',
            type: 'string',
            defaultValue: String(wrong),
            disabled: true,
            required: false,
          },
          {
            name: 'accuracy',
            label: 'Accuracy',
            type: 'string',
            defaultValue: accuracy,
            disabled: true,
            required: false,
          },
        ],
        acceptLabel: 'Done',
        cancelLabel: 'Close',
      },
    },
  });
});

menu.post('/settings', async (c) => {
  const config = await getConfig();
  const savedList = config.reviewers.length > 0 ? config.reviewers.join(', ') : '(none)';

  return c.json<UiResponse>({
    showForm: {
      name: 'settingsForm',
      form: {
        title: 'ShadowMod settings',
        description: `Comma-separated list of Reddit usernames who act as Reviewers for this subreddit.\n\nCurrently saved: ${savedList}`,
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
