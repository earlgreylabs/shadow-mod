import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => {
  type ZMember = { member: string; score: number };
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, ZMember[]>();
  const settingsValues = new Map<string, any>();
  const globToRegex = (glob: string): RegExp =>
    new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

  const redisMock = {
    get: vi.fn(async (key: string) => strings.get(key)),
    set: vi.fn(async (key: string, value: string) => {
      strings.set(key, value);
      return 'OK';
    }),
    hIncrBy: vi.fn(async (key: string, field: string, delta: number) => {
      const h = hashes.get(key) ?? new Map<string, string>();
      const next = Number.parseInt(h.get(field) ?? '0', 10) + delta;
      h.set(field, String(next));
      hashes.set(key, h);
      return next;
    }),
    hGetAll: vi.fn(async (key: string) => {
      const h = hashes.get(key);
      return h ? Object.fromEntries(h.entries()) : {};
    }),
    zAdd: vi.fn(async (key: string, member: ZMember) => {
      const arr = zsets.get(key) ?? [];
      const i = arr.findIndex((m) => m.member === member.member);
      if (i >= 0) arr[i] = member;
      else arr.push(member);
      zsets.set(key, arr);
      return 1;
    }),
    zRem: vi.fn(async (key: string, members: string[]) => {
      const arr = zsets.get(key) ?? [];
      const next = arr.filter((m) => !members.includes(m.member));
      zsets.set(key, next);
      return arr.length - next.length;
    }),
    zScan: vi.fn(async (key: string, _cursor: number, pattern: string) => {
      const arr = zsets.get(key) ?? [];
      const r = globToRegex(pattern);
      return { cursor: 0, members: arr.filter((m) => r.test(m.member)) };
    }),
    _reset() {
      strings.clear();
      hashes.clear();
      zsets.clear();
    },
  };

  const settingsMock = {
    get: vi.fn(async (key: string) => settingsValues.get(key)),
    getAll: vi.fn(async () => Object.fromEntries(settingsValues.entries())),
    set: vi.fn(async (key: string, value: any) => {
      settingsValues.set(key, value);
    }),
    _reset() {
      settingsValues.clear();
    },
  };

  return {
    redisMock,
    settingsMock,
    redditMock: {
      sendPrivateMessage: vi.fn(),
      addModNote: vi.fn(),
      getPostById: vi.fn(async (id: string) => ({
        id,
        title: `Title for ${id}`,
        permalink: `/comments/${id}`,
        approved: false,
        removed: false,
        spam: false,
      })),
    },
    schedulerMock: { runJob: vi.fn() },
    ctx: {} as {
      postId?: string;
      userId?: string;
      username?: string;
      subredditName?: string;
    },
  };
});

const { redisMock } = mocks;

vi.mock('@devvit/web/server', () => ({
  redis: mocks.redisMock,
  reddit: mocks.redditMock,
  scheduler: mocks.schedulerMock,
  settings: mocks.settingsMock,
  get context() {
    return mocks.ctx;
  },
}));

import { forms } from './forms.js';
import {
  getObserverDecision,
  getReviewerDecision,
  saveObserverDecision,
} from '../core/decisions.js';

function mountForms() {
  const app = new Hono();
  app.route('/form', forms);
  return app;
}

async function submit(app: Hono, path: string, body: unknown) {
  return await app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  redisMock._reset();
  mocks.settingsMock._reset();
  mocks.schedulerMock.runJob.mockReset();
  mocks.ctx.postId = 't3_abc';
  mocks.ctx.userId = 't2_obs';
  mocks.ctx.username = 'observer_user';
  mocks.ctx.subredditName = 'shadow_mod_dev';
});

describe('POST /form/observation-submit', () => {
  it('persists an observer decision', async () => {
    const res = await submit(mountForms(), '/form/observation-submit', {
      action: ['remove'],
      reason: 'spammy',
    });
    expect(res.status).toBe(200);
    const stored = await getObserverDecision('t3_abc', 't2_obs');
    expect(stored?.action).toBe('remove');
    expect(stored?.reason).toBe('spammy');
    expect(stored?.status).toBe('pending_review');
  });

  it('rejects empty submissions with a toast', async () => {
    const res = await submit(mountForms(), '/form/observation-submit', {
      action: [],
      reason: '',
    });
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/required/i);
  });
});

describe('POST /form/review-submit', () => {
  const observer = {
    id: 't3_abc:t2_obs',
    postId: 't3_abc',
    observerId: 't2_obs',
    observerName: 'observer_user',
    action: 'remove' as const,
    reason: 'spam',
    timestamp: '2026-05-16T00:00:00.000Z',
    status: 'pending_review' as const,
  };

  it('persists a reviewer decision and transitions observer status', async () => {
    await saveObserverDecision(observer);

    mocks.ctx.userId = 't2_rev';
    mocks.ctx.username = 'reviewer_user';

    const res = await submit(mountForms(), '/form/review-submit', {
      action: ['approve'],
      reason: 'fine',
    });
    expect(res.status).toBe(200);

    const reviewer = await getReviewerDecision('t3_abc', 't2_rev');
    expect(reviewer?.action).toBe('approve');

    const observerObj = await getObserverDecision('t3_abc', 't2_obs');
    expect(observerObj?.status).toBe('pending_report');
  });

  it('triggers the report immediately if the post is already approved on Reddit', async () => {
    await saveObserverDecision(observer);

    mocks.ctx.userId = 't2_rev';
    mocks.ctx.username = 'reviewer_user';

    // Mock the post to be already approved
    mocks.redditMock.getPostById.mockResolvedValueOnce({
      id: 't3_abc',
      title: 'Title for t3_abc',
      permalink: '/comments/abc',
      approved: true,
      removed: false,
      spam: false,
    });

    const res = await submit(mountForms(), '/form/review-submit', {
      action: ['approve'],
      reason: 'fine',
    });
    expect(res.status).toBe(200);

    // Observer status should be updated to complete
    const observerObj = await getObserverDecision('t3_abc', 't2_obs');
    expect(observerObj?.status).toBe('complete');

    // It should have scheduled a report job
    expect(mocks.schedulerMock.runJob).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'generate-report',
        data: expect.objectContaining({
          postId: 't3_abc',
          observerId: 't2_obs',
          finalAction: 'approve',
        }),
      }),
    );
  });
});
