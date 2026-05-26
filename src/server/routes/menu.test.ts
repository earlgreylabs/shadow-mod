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
    redditMock: {
      sendPrivateMessage: vi.fn(),
      addModNote: vi.fn(),
      getPostById: vi.fn(async (id: string) => ({ title: `Title for ${id}` })),
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
  get context() {
    return mocks.ctx;
  },
}));

import { menu } from './menu.js';
import { setConfig } from '../core/config.js';
import { saveObserverDecision } from '../core/decisions.js';

function mountMenu() {
  const app = new Hono();
  app.route('/menu', menu);
  return app;
}

async function postJson(app: Hono, path: string) {
  return await app.request(path, { method: 'POST' });
}

beforeEach(() => {
  redisMock._reset();
  mocks.ctx.postId = 't3_abc';
  mocks.ctx.userId = 't2_obs';
  mocks.ctx.username = 'observer_user';
  mocks.ctx.subredditName = 'shadow_mod_dev';
});

describe('POST /menu/observation', () => {
  it('shows the form when no observation exists yet', async () => {
    const res = await postJson(mountMenu(), '/menu/observation');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { showForm?: { name: string } };
    expect(body.showForm?.name).toBe('observationForm');
  });

  it('blocks reviewers from recording an observation', async () => {
    await setConfig({ reviewers: ['observer_user'] });
    const res = await postJson(mountMenu(), '/menu/observation');
    const body = (await res.json()) as { showToast?: string };
    expect(typeof body.showToast).toBe('string');
    expect(body.showToast).toMatch(/Record review/i);
  });

  it('blocks duplicate observations from the same observer on a post', async () => {
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
    const res = await postJson(mountMenu(), '/menu/observation');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/already have a pending observation/i);
  });

  it('reports a session error when context is incomplete', async () => {
    mocks.ctx.postId = undefined;
    const res = await postJson(mountMenu(), '/menu/observation');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/Could not identify/i);
  });
});

describe('POST /menu/review', () => {
  beforeEach(() => {
    mocks.ctx.userId = 't2_rev';
    mocks.ctx.username = 'reviewer_user';
  });

  it('rejects non-reviewers', async () => {
    const res = await postJson(mountMenu(), '/menu/review');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/Only Reviewers/i);
  });

  it('rejects when there are no pending observations on the post', async () => {
    await setConfig({ reviewers: ['reviewer_user'] });
    const res = await postJson(mountMenu(), '/menu/review');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No pending observations/i);
  });

  it('shows the review form when there is a pending observation', async () => {
    await setConfig({ reviewers: ['reviewer_user'] });
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

    const res = await postJson(mountMenu(), '/menu/review');
    const body = (await res.json()) as {
      showForm?: { name: string; form: { description: string } };
    };
    expect(body.showForm?.name).toBe('reviewForm');
    expect(body.showForm?.form.description).toContain('observer_user');
  });
});

describe('POST /menu/queue', () => {
  beforeEach(() => {
    mocks.ctx.userId = 't2_rev';
    mocks.ctx.username = 'reviewer_user';
  });

  it('rejects non-reviewers', async () => {
    const res = await postJson(mountMenu(), '/menu/queue');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/Only Reviewers/i);
  });

  it('returns a toast when no posts are pending', async () => {
    await setConfig({ reviewers: ['reviewer_user'] });
    const res = await postJson(mountMenu(), '/menu/queue');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No posts are waiting/i);
  });

  it('shows queue form with pending post options when observations exist', async () => {
    await setConfig({ reviewers: ['reviewer_user'] });
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

    const res = await postJson(mountMenu(), '/menu/queue');
    const body = (await res.json()) as {
      showForm?: {
        name: string;
        form: { fields: { options: { label: string; value: string }[] }[] };
      };
    };
    expect(body.showForm?.name).toBe('queueForm');
    const options = body.showForm?.form.fields[0]?.options;
    expect(options).toBeDefined();
    const option = options?.find((o) => o.value === 't3_abc');
    expect(option).toBeDefined();
    expect(option?.label).toContain('Title for t3_abc');
    expect(option?.label).toContain('observer_user');
  });

  it('falls back to postId in label when getPostById throws', async () => {
    mocks.redditMock.getPostById.mockRejectedValueOnce(new Error('network error'));
    await setConfig({ reviewers: ['reviewer_user'] });
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

    const res = await postJson(mountMenu(), '/menu/queue');
    const body = (await res.json()) as {
      showForm?: {
        name: string;
        form: { fields: { options: { label: string; value: string }[] }[] };
      };
    };
    const options = body.showForm?.form.fields[0]?.options;
    const option = options?.find((o) => o.value === 't3_abc');
    expect(option?.label).toContain('t3_abc');
  });

  it('does not include non-pending_review observations in the queue', async () => {
    await setConfig({ reviewers: ['reviewer_user'] });
    await saveObserverDecision({
      id: 't3_abc:t2_obs',
      postId: 't3_abc',
      observerId: 't2_obs',
      observerName: 'observer_user',
      action: 'remove',
      reason: 'spam',
      timestamp: '2026-05-16T00:00:00.000Z',
      status: 'pending_report',
    });

    const res = await postJson(mountMenu(), '/menu/queue');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No posts are waiting/i);
  });

  it('reports a session error when context is missing user', async () => {
    mocks.ctx.userId = undefined;
    const res = await postJson(mountMenu(), '/menu/queue');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/Could not identify/i);
  });
});

describe('POST /menu/stats', () => {
  it('reports zero stats when nothing recorded', async () => {
    const res = await postJson(mountMenu(), '/menu/stats');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No completed observations/i);
  });
});

describe('POST /menu/settings', () => {
  it('shows settings form with current reviewers prefilled', async () => {
    await setConfig({ reviewers: ['alice', 'bob'] });
    const res = await postJson(mountMenu(), '/menu/settings');
    const body = (await res.json()) as {
      showForm?: { form: { fields: { defaultValue?: string }[] } };
    };
    expect(body.showForm?.form.fields[0]?.defaultValue).toBe('alice, bob');
  });
});
