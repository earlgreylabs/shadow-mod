import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  // Inlined here because vi.hoisted runs before any imports — we can't pull in
  // a helper module. Shape mirrors __tests__/_setup-mock.ts (kept in sync).
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
    ctx: { subredditName: 'shadow_mod_dev' } as {
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

import {
  saveObserverDecision,
  getObserverDecision,
  hasObserverDecision,
  updateObserverStatus,
  removePending,
  saveReviewerDecision,
  getReviewerDecision,
  getReviewerDecisionsForPost,
  getPendingForPost,
  getAllPending,
} from './decisions.js';
import type { ObserverDecision, ReviewerDecision } from '@/shared/types.js';

const baseObserver: ObserverDecision = {
  id: 't3_abc:t2_obs',
  postId: 't3_abc',
  observerId: 't2_obs',
  observerName: 'observer_user',
  action: 'remove',
  reason: 'spam',
  timestamp: '2026-05-16T00:00:00.000Z',
  status: 'pending_review',
};

const baseReviewer: ReviewerDecision = {
  postId: 't3_abc',
  reviewerId: 't2_rev',
  reviewerName: 'reviewer_user',
  action: 'remove',
  reason: 'spam too',
  timestamp: '2026-05-16T00:01:00.000Z',
};

describe('observer decisions', () => {
  beforeEach(() => {
    redisMock._reset();
  });

  it('round-trips an observer decision', async () => {
    await saveObserverDecision(baseObserver);
    const fetched = await getObserverDecision(baseObserver.postId, baseObserver.observerId);
    expect(fetched).toEqual(baseObserver);
  });

  it('hasObserverDecision returns true after save, false otherwise', async () => {
    expect(await hasObserverDecision('t3_abc', 't2_obs')).toBe(false);
    await saveObserverDecision(baseObserver);
    expect(await hasObserverDecision('t3_abc', 't2_obs')).toBe(true);
  });

  it('updateObserverStatus transitions status', async () => {
    await saveObserverDecision(baseObserver);
    await updateObserverStatus('t3_abc', 't2_obs', 'pending_report');
    const after1 = await getObserverDecision('t3_abc', 't2_obs');
    expect(after1?.status).toBe('pending_report');
    await updateObserverStatus('t3_abc', 't2_obs', 'complete');
    const after2 = await getObserverDecision('t3_abc', 't2_obs');
    expect(after2?.status).toBe('complete');
  });

  it('updateObserverStatus no-ops when nothing stored', async () => {
    await updateObserverStatus('t3_missing', 't2_missing', 'complete');
    expect(await getObserverDecision('t3_missing', 't2_missing')).toBeNull();
  });

  it('removePending drops the post from the pending sorted set', async () => {
    await saveObserverDecision(baseObserver);
    expect(await getPendingForPost('t3_abc')).toHaveLength(1);
    await removePending('t3_abc', 't2_obs');
    expect(await getPendingForPost('t3_abc')).toHaveLength(0);
  });
});

describe('reviewer decisions', () => {
  beforeEach(() => {
    redisMock._reset();
  });

  it('round-trips a reviewer decision', async () => {
    await saveReviewerDecision(baseReviewer);
    const fetched = await getReviewerDecision(baseReviewer.postId, baseReviewer.reviewerId);
    expect(fetched).toEqual(baseReviewer);
  });

  it('getReviewerDecisionsForPost returns every reviewer who weighed in', async () => {
    await saveReviewerDecision(baseReviewer);
    await saveReviewerDecision({
      ...baseReviewer,
      reviewerId: 't2_rev2',
      reviewerName: 'reviewer_two',
      action: 'approve',
    });
    const all = await getReviewerDecisionsForPost('t3_abc');
    expect(all).toHaveLength(2);
    const ids = all.map((r) => r.reviewerId).sort();
    expect(ids).toEqual(['t2_rev', 't2_rev2']);
  });
});

describe('getAllPending', () => {
  beforeEach(() => {
    redisMock._reset();
  });

  it('returns empty array when no observations exist', async () => {
    const result = await getAllPending();
    expect(result).toEqual([]);
  });

  it('returns a single entry with observer names for a pending_review observation', async () => {
    await saveObserverDecision(baseObserver);
    const result = await getAllPending();
    expect(result).toHaveLength(1);
    expect(result[0].postId).toBe('t3_abc');
    expect(result[0].observerNames).toEqual(['observer_user']);
  });

  it('groups multiple observers on the same post', async () => {
    await saveObserverDecision(baseObserver);
    await saveObserverDecision({
      ...baseObserver,
      id: 't3_abc:t2_obs2',
      observerId: 't2_obs2',
      observerName: 'observer_two',
    });
    const result = await getAllPending();
    expect(result).toHaveLength(1);
    expect(result[0].postId).toBe('t3_abc');
    expect(result[0].observerNames).toHaveLength(2);
    expect(result[0].observerNames).toContain('observer_user');
    expect(result[0].observerNames).toContain('observer_two');
  });

  it('returns entries for each distinct post', async () => {
    await saveObserverDecision(baseObserver);
    await saveObserverDecision({
      ...baseObserver,
      id: 't3_xyz:t2_obs',
      postId: 't3_xyz',
      observerName: 'observer_user',
    });
    const result = await getAllPending();
    expect(result).toHaveLength(2);
    const postIds = result.map((r) => r.postId).sort();
    expect(postIds).toEqual(['t3_abc', 't3_xyz']);
  });

  it('excludes observations that are not pending_review', async () => {
    await saveObserverDecision({ ...baseObserver, status: 'pending_report' });
    const result = await getAllPending();
    expect(result).toEqual([]);
  });

  it('excludes complete observations', async () => {
    await saveObserverDecision({ ...baseObserver, status: 'complete' });
    const result = await getAllPending();
    expect(result).toEqual([]);
  });
});

describe('zod guardrails on Redis reads', () => {
  beforeEach(() => {
    redisMock._reset();
  });

  it('returns null and warns when stored payload is malformed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await redisMock.set('observer:t3_abc:t2_obs', '{"not":"valid"}');
    const result = await getObserverDecision('t3_abc', 't2_obs');
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns null and warns when stored JSON is broken', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await redisMock.set('reviewer:t3_abc:t2_rev', '{broken json');
    const result = await getReviewerDecision('t3_abc', 't2_rev');
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
