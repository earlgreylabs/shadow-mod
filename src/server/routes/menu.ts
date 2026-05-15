import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import { hasShadowDecision, getPendingForPost } from '../core/decisions.js';
import { isSeniorMod, getConfig } from '../core/config.js';
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

  // Senior mods should use the review action, not this one
  if (await isSeniorMod(username)) {
    return c.json<UiResponse>({
      showToast: 'Senior mods use "Review shadow decision" instead.',
    });
  }

  if (await hasShadowDecision(postId, userId)) {
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

  if (!(await isSeniorMod(username))) {
    return c.json<UiResponse>({
      showToast: 'Only senior mods can review shadow decisions. Ask your admin to add you in ShadowMod settings.',
    });
  }

  const allPending = await getPendingForPost(postId);
  const pending = allPending.filter(d => d.status === 'pending_senior');
  if (pending.length === 0) {
    return c.json<UiResponse>({
      showToast: 'No pending shadow decisions for this post.',
    });
  }

  const traineeNames = pending.map(d => d.shadowModName).join(', ');

  return c.json<UiResponse>({
    showForm: {
      name: 'seniorReviewForm',
      form: {
        title: 'Review shadow decision',
        description: `Pending from: ${traineeNames}. Record your independent decision before taking real action.`,
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

menu.post('/settings', async (c) => {
  const config = await getConfig();

  return c.json<UiResponse>({
    showForm: {
      name: 'settingsForm',
      form: {
        title: 'ShadowMod settings',
        description: 'Comma-separated list of Reddit usernames who act as senior reviewers.',
        fields: [
          {
            name: 'seniorMods',
            label: 'Senior mod usernames',
            type: 'string',
            placeholder: 'e.g. username1, username2',
            defaultValue: config.seniorMods.join(', '),
            required: false,
          },
        ],
        acceptLabel: 'Save',
      },
    },
  });
});
