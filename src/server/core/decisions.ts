import { redis } from '@devvit/web/server';
import type { ShadowDecision, SeniorDecision, DecisionStatus } from '../../shared/types.js';

// Key patterns — all namespaced per-installation by Devvit automatically
const shadowKey  = (postId: string, modId: string) => `decision:${postId}:${modId}`;
const seniorKey  = (postId: string, modId: string) => `senior:${postId}:${modId}`;
const pendingKey = () => 'pending'; // sorted set: member="{postId}:{modId}", score=timestamp

// --- Shadow decisions ---

export async function saveShadowDecision(d: ShadowDecision): Promise<void> {
  await redis.set(shadowKey(d.postId, d.shadowModId), JSON.stringify(d));
  await redis.zAdd(pendingKey(), {
    member: `${d.postId}:${d.shadowModId}`,
    score: Date.now(),
  });
}

export async function getShadowDecision(
  postId: string,
  shadowModId: string,
): Promise<ShadowDecision | null> {
  const raw = await redis.get(shadowKey(postId, shadowModId));
  return raw ? (JSON.parse(raw) as ShadowDecision) : null;
}

export async function updateShadowStatus(
  postId: string,
  shadowModId: string,
  status: DecisionStatus,
): Promise<void> {
  const existing = await getShadowDecision(postId, shadowModId);
  if (!existing) return;
  await redis.set(shadowKey(postId, shadowModId), JSON.stringify({ ...existing, status }));
}

// Returns all pending shadow decisions for a post (multiple trainees possible)
export async function getPendingForPost(postId: string): Promise<ShadowDecision[]> {
  // Scan the sorted set for members matching postId prefix
  const { members } = await redis.zScan(pendingKey(), 0, `${postId}:*`, 100);
  const decisions: ShadowDecision[] = [];
  for (const { member } of members) {
    const [, modId] = member.split(':');
    if (!modId) continue;
    const d = await getShadowDecision(postId, modId);
    if (d && d.status === 'pending_senior') decisions.push(d);
  }
  return decisions;
}

export async function hasShadowDecision(postId: string, shadowModId: string): Promise<boolean> {
  return (await redis.get(shadowKey(postId, shadowModId))) !== undefined;
}

// --- Senior decisions ---

export async function saveSeniorDecision(d: SeniorDecision): Promise<void> {
  await redis.set(seniorKey(d.postId, d.seniorModId), JSON.stringify(d));
}

export async function getSeniorDecision(
  postId: string,
  seniorModId: string,
): Promise<SeniorDecision | null> {
  const raw = await redis.get(seniorKey(postId, seniorModId));
  return raw ? (JSON.parse(raw) as SeniorDecision) : null;
}

// Returns all senior decisions for a post
export async function getSeniorDecisionsForPost(postId: string): Promise<SeniorDecision[]> {
  const { members } = await redis.zScan(pendingKey(), 0, `${postId}:*`, 100);
  const decisions: SeniorDecision[] = [];
  for (const { member } of members) {
    const [, modId] = member.split(':');
    if (!modId) continue;
    const d = await getSeniorDecision(postId, modId);
    if (d) decisions.push(d);
  }
  return decisions;
}

export async function removePending(postId: string, shadowModId: string): Promise<void> {
  await redis.zRem(pendingKey(), [`${postId}:${shadowModId}`]);
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
