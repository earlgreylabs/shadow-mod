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
  settings: mocks.settingsMock,
  get context() {
    return mocks.ctx;
  },
}));

import { menu } from './menu.js';
import { saveObserverDecision } from '../core/decisions.js';

async function setConfig(config: { reviewers: string[] }): Promise<void> {
  await mocks.settingsMock.set('reviewers', config.reviewers.join(', '));
}

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
  mocks.settingsMock._reset();
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
  it('reports zero stats when nothing recorded for observer', async () => {
    const res = await postJson(mountMenu(), '/menu/stats');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No completed observations/i);
  });

  it('reports zero stats when nothing recorded for reviewer', async () => {
    await setConfig({ reviewers: ['observer_user'] });
    const res = await postJson(mountMenu(), '/menu/stats');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No completed reviews/i);
  });

  it('falls back to Redis config when native setting is empty', async () => {
    await redisMock.set('config:reviewers', JSON.stringify({ reviewers: ['observer_user'] }));
    const res = await postJson(mountMenu(), '/menu/stats');
    const body = (await res.json()) as { showToast?: string };
    expect(body.showToast).toMatch(/No completed reviews/i);
  });

  it('returns observer stats form when stats exist', async () => {
    await redisMock.hIncrBy('stats:t2_obs', 'total', 5);
    await redisMock.hIncrBy('stats:t2_obs', 'correct', 4);
    await redisMock.hIncrBy('stats:t2_obs', 'wrong', 1);

    const res = await postJson(mountMenu(), '/menu/stats');
    const body = (await res.json()) as {
      showForm?: {
        name: string;
        form: {
          title: string;
          description: string;
          fields: { name: string; label: string; defaultValue: string }[];
        };
      };
    };
    expect(body.showForm?.name).toBe('statsForm');
    expect(body.showForm?.form.title).toContain('Observer');
    const fields = body.showForm?.form.fields;
    expect(fields?.find((f) => f.name === 'total')?.label).toBe('Total completed');
    expect(fields?.find((f) => f.name === 'total')?.defaultValue).toBe('5');
    expect(fields?.find((f) => f.name === 'correct')?.label).toBe('Matched reviewer');
    expect(fields?.find((f) => f.name === 'correct')?.defaultValue).toBe('4');
    expect(fields?.find((f) => f.name === 'wrong')?.label).toBe('Diverged');
    expect(fields?.find((f) => f.name === 'wrong')?.defaultValue).toBe('1');
    expect(fields?.find((f) => f.name === 'accuracy')?.defaultValue).toBe('80.0%');
  });

  it('returns reviewer stats form when stats exist', async () => {
    await setConfig({ reviewers: ['observer_user'] });
    await redisMock.hIncrBy('stats:t2_obs', 'total', 10);
    await redisMock.hIncrBy('stats:t2_obs', 'correct', 7);
    await redisMock.hIncrBy('stats:t2_obs', 'wrong', 3);

    const res = await postJson(mountMenu(), '/menu/stats');
    const body = (await res.json()) as {
      showForm?: {
        name: string;
        form: {
          title: string;
          description: string;
          fields: { name: string; label: string; defaultValue: string }[];
        };
      };
    };
    expect(body.showForm?.name).toBe('statsForm');
    expect(body.showForm?.form.title).toContain('Reviewer');
    const fields = body.showForm?.form.fields;
    expect(fields?.find((f) => f.name === 'total')?.label).toBe('Total reviews compared');
    expect(fields?.find((f) => f.name === 'total')?.defaultValue).toBe('10');
    expect(fields?.find((f) => f.name === 'correct')?.label).toBe('Trainees agreed');
    expect(fields?.find((f) => f.name === 'correct')?.defaultValue).toBe('7');
    expect(fields?.find((f) => f.name === 'wrong')?.label).toBe('Trainees diverged');
    expect(fields?.find((f) => f.name === 'wrong')?.defaultValue).toBe('3');
    expect(fields?.find((f) => f.name === 'accuracy')?.defaultValue).toBe('70.0%');
  });
});
