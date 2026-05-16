import { redis } from '@devvit/web/server';
import type { ObserverDecision, ReviewerDecision, DecisionStatus } from '../../shared/types.js';

// Key patterns — all namespaced per-installation by Devvit automatically
const observerKey  = (postId: string, observerId: string) => `observer:${postId}:${observerId}`;
const reviewerKey  = (postId: string, reviewerId: string) => `reviewer:${postId}:${reviewerId}`;
const pendingKey   = () => 'pending'; // sorted set: member="{postId}:{observerId}", score=timestamp
const reviewersKey = () => 'reviewers_set'; // sorted set: member="{postId}:{reviewerId}", score=timestamp

// --- Observer decisions ---

export async function saveObserverDecision(d: ObserverDecision): Promise<void> {
  await redis.set(observerKey(d.postId, d.observerId), JSON.stringify(d));
  await redis.zAdd(pendingKey(), {
    member: `${d.postId}:${d.observerId}`,
    score: Date.now(),
  });
}

export async function getObserverDecision(
  postId: string,
  observerId: string,
): Promise<ObserverDecision | null> {
  const raw = await redis.get(observerKey(postId, observerId));
  return raw ? (JSON.parse(raw) as ObserverDecision) : null;
}

export async function updateObserverStatus(
  postId: string,
  observerId: string,
  status: DecisionStatus,
): Promise<void> {
  const existing = await getObserverDecision(postId, observerId);
  if (!existing) return;
  await redis.set(observerKey(postId, observerId), JSON.stringify({ ...existing, status }));
}

// Returns all observer decisions for a post still in the pending set (any status).
// Callers filter by status as needed.
export async function getPendingForPost(postId: string): Promise<ObserverDecision[]> {
  const { members } = await redis.zScan(pendingKey(), 0, `${postId}:*`, 100);
  const decisions: ObserverDecision[] = [];
  for (const { member } of members) {
    // member format: "{postId}:{observerId}" — observerId is a t2_ thing ID (no internal colons)
    const colonIdx = member.indexOf(':');
    const observerId = colonIdx >= 0 ? member.slice(colonIdx + 1) : undefined;
    if (!observerId) continue;
    const d = await getObserverDecision(postId, observerId);
    if (d) decisions.push(d);
  }
  return decisions;
}

export async function hasObserverDecision(postId: string, observerId: string): Promise<boolean> {
  return (await redis.get(observerKey(postId, observerId))) !== undefined;
}

export async function removePending(postId: string, observerId: string): Promise<void> {
  await redis.zRem(pendingKey(), [`${postId}:${observerId}`]);
}

// --- Reviewer decisions ---

export async function saveReviewerDecision(d: ReviewerDecision): Promise<void> {
  await redis.set(reviewerKey(d.postId, d.reviewerId), JSON.stringify(d));
  await redis.zAdd(reviewersKey(), {
    member: `${d.postId}:${d.reviewerId}`,
    score: Date.now(),
  });
}

export async function getReviewerDecision(
  postId: string,
  reviewerId: string,
): Promise<ReviewerDecision | null> {
  const raw = await redis.get(reviewerKey(postId, reviewerId));
  return raw ? (JSON.parse(raw) as ReviewerDecision) : null;
}

// Returns all reviewer decisions for a post, using the reviewers sorted set.
export async function getReviewerDecisionsForPost(postId: string): Promise<ReviewerDecision[]> {
  const { members } = await redis.zScan(reviewersKey(), 0, `${postId}:*`, 100);
  const decisions: ReviewerDecision[] = [];
  for (const { member } of members) {
    // member format: "{postId}:{reviewerId}"
    const colonIdx = member.indexOf(':');
    const reviewerId = colonIdx >= 0 ? member.slice(colonIdx + 1) : undefined;
    if (!reviewerId) continue;
    const d = await getReviewerDecision(postId, reviewerId);
    if (d) decisions.push(d);
  }
  return decisions;
}

// --- Stats ---

export async function incrementStats(
  userId: string,
  agreed: boolean,
): Promise<void> {
  const key = `stats:${userId}`;
  await redis.hIncrBy(key, 'total', 1);
  await redis.hIncrBy(key, agreed ? 'correct' : 'wrong', 1);
}

export async function getStats(userId: string): Promise<Record<string, string>> {
  return (await redis.hGetAll(`stats:${userId}`)) ?? {};
}
