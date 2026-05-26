import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  };
});

const { redisMock, redditMock } = mocks;

vi.mock('@devvit/web/server', () => ({
  redis: mocks.redisMock,
  reddit: mocks.redditMock,
  scheduler: mocks.schedulerMock,
  context: { subredditName: 'shadow_mod_dev' },
}));

import { buildReport, generateReport } from './reports.js';
import {
  saveObserverDecision,
  saveReviewerDecision,
  updateObserverStatus,
  getObserverDecision,
  getStats,
} from './decisions.js';
import type { ObserverDecision, ReviewerDecision, ReportJobData } from '@/shared/types.js';

const observer: ObserverDecision = {
  id: 't3_abc:t2_obs',
  postId: 't3_abc',
  observerId: 't2_obs',
  observerName: 'observer_user',
  action: 'remove',
  reason: 'spam',
  timestamp: '2026-05-16T00:00:00.000Z',
  status: 'pending_report',
};

const reviewer: ReviewerDecision = {
  postId: 't3_abc',
  reviewerId: 't2_rev',
  reviewerName: 'reviewer_user',
  action: 'remove',
  reason: 'agree',
  timestamp: '2026-05-16T00:01:00.000Z',
};

describe('buildReport', () => {
  it('marks agreement=true when actions match', () => {
    const report = buildReport(observer, reviewer, 'removelink', 'Title', '/r/x/y');
    expect(report.agreement).toBe(true);
    expect(report.observer).toBe(observer);
    expect(report.reviewer).toBe(reviewer);
    expect(report.finalAction).toBe('removelink');
    expect(report.postPermalink).toBe('/r/x/y');
    expect(report.postTitle).toBe('Title');
  });

  it('marks agreement=false on divergence', () => {
    const report = buildReport(
      { ...observer, action: 'remove' },
      { ...reviewer, action: 'approve' },
      'approvelink',
      'Title',
      '/r/x/y',
    );
    expect(report.agreement).toBe(false);
  });
});

describe('generateReport', () => {
  beforeEach(() => {
    redisMock._reset();
    redditMock.sendPrivateMessage.mockReset();
    redditMock.addModNote.mockReset();
  });

  const jobData: ReportJobData = {
    postId: 't3_abc',
    observerId: 't2_obs',
    finalAction: 'removelink',
    postTitle: 'Title',
    postPermalink: '/r/x/y',
  };

  it('no-ops when no observation is stored', async () => {
    await generateReport(jobData, 'shadow_mod_dev');
    expect(redditMock.sendPrivateMessage).not.toHaveBeenCalled();
    expect(redditMock.addModNote).not.toHaveBeenCalled();
  });

  it('no-ops when no reviewer decisions exist', async () => {
    await saveObserverDecision(observer);
    await generateReport(jobData, 'shadow_mod_dev');
    expect(redditMock.sendPrivateMessage).not.toHaveBeenCalled();
    expect(redditMock.addModNote).not.toHaveBeenCalled();
  });

  it('delivers via modmail, updates stats and status on success', async () => {
    await saveObserverDecision(observer);
    await saveReviewerDecision(reviewer);
    redditMock.sendPrivateMessage.mockResolvedValue(undefined);

    await generateReport(jobData, 'shadow_mod_dev');

    expect(redditMock.sendPrivateMessage).toHaveBeenCalledTimes(2);
    expect(redditMock.sendPrivateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'observer_user' }),
    );
    expect(redditMock.sendPrivateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'reviewer_user' }),
    );
    expect(redditMock.addModNote).not.toHaveBeenCalled();

    const stats = await getStats('t2_obs');
    expect(stats['total']).toBe('1');
    expect(stats['correct']).toBe('1');

    const after = await getObserverDecision('t3_abc', 't2_obs');
    expect(after?.status).toBe('complete');
  });

  it('falls back to mod note when modmail fails', async () => {
    await saveObserverDecision(observer);
    await saveReviewerDecision({ ...reviewer, action: 'approve' });
    redditMock.sendPrivateMessage.mockRejectedValueOnce(new Error('boom'));

    await generateReport(jobData, 'shadow_mod_dev');

    expect(redditMock.addModNote).toHaveBeenCalledOnce();
    const stats = await getStats('t2_obs');
    expect(stats['total']).toBe('1');
    expect(stats['wrong']).toBe('1');
  });

  it('uses the most recent reviewer when multiple exist', async () => {
    await saveObserverDecision(observer);
    await saveReviewerDecision(reviewer);
    await saveReviewerDecision({
      ...reviewer,
      reviewerId: 't2_rev2',
      reviewerName: 'reviewer_two',
      action: 'approve',
    });
    redditMock.sendPrivateMessage.mockResolvedValue(undefined);

    await updateObserverStatus('t3_abc', 't2_obs', 'pending_report');
    await generateReport(jobData, 'shadow_mod_dev');

    expect(redditMock.sendPrivateMessage).toHaveBeenCalledTimes(2);
  });
});
