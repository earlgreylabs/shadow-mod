import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => {
  type ZMember = { member: string; score: number };
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, ZMember[]>();
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
  return {
    redisMock,
    redditMock: { sendPrivateMessage: vi.fn(), addModNote: vi.fn() },
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
import { getConfig } from '../core/config.js';

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
  mocks.ctx.postId = 't3_abc';
  mocks.ctx.userId = 't2_obs';
  mocks.ctx.username = 'observer_user';
  mocks.ctx.subredditName = 'shadow_mod_dev';
});

describe('POST /form/observation-submit', () => {
  it('persists an observer decision', async () => {
    const res = await submit(mountForms(), '/form/observation-submit', {
      values: { action: ['remove'], reason: 'spammy' },
    });
    expect(res.status).toBe(200);
    const stored = await getObserverDecision('t3_abc', 't2_obs');
    expect(stored?.action).toBe('remove');
    expect(stored?.reason).toBe('spammy');
    expect(stored?.status).toBe('pending_review');
  });

  it('rejects empty submissions with a toast', async () => {
    const res = await submit(mountForms(), '/form/observation-submit', {
      values: { action: [], reason: '' },
    });
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/required/i);
  });
});

describe('POST /form/review-submit', () => {
  it('persists a reviewer decision and transitions observer status', async () => {
    await saveObserverDecision({
      id: 't3_abc:t2_obs',
      postId: 't3_abc',
      observerId: 't2_obs',
      observerName: 'observer_user',
      action: 'remove',
      reason: 'spam',
      timestamp: '2026-05-16T00:00:00.000Z',
      status: 'pending_review',
    });

    mocks.ctx.userId = 't2_rev';
    mocks.ctx.username = 'reviewer_user';

    const res = await submit(mountForms(), '/form/review-submit', {
      values: { action: ['approve'], reason: 'fine' },
    });
    expect(res.status).toBe(200);

    const reviewer = await getReviewerDecision('t3_abc', 't2_rev');
    expect(reviewer?.action).toBe('approve');

    const observer = await getObserverDecision('t3_abc', 't2_obs');
    expect(observer?.status).toBe('pending_report');
  });
});

describe('POST /form/settings-submit', () => {
  it('parses comma-separated reviewer usernames into config', async () => {
    const res = await submit(mountForms(), '/form/settings-submit', {
      values: { reviewers: 'alice, bob, ,carol' },
    });
    expect(res.status).toBe(200);
    const config = await getConfig();
    expect(config.reviewers).toEqual(['alice', 'bob', 'carol']);
  });
});
