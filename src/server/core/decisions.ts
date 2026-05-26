import { redis } from '@devvit/web/server';
import type { ObserverDecision, ReviewerDecision, DecisionStatus } from '@/shared/types.js';
import { ObserverDecisionSchema, ReviewerDecisionSchema } from '@/shared/schemas.js';

// Key patterns — all namespaced per-installation by Devvit automatically.
const observerKey = (postId: string, observerId: string) => `observer:${postId}:${observerId}`;
const reviewerKey = (postId: string, reviewerId: string) => `reviewer:${postId}:${reviewerId}`;
const pendingKey = () => 'pending'; // sorted set: member="{postId}:{observerId}", score=timestamp
const reviewersKey = () => 'reviewers_set'; // sorted set: member="{postId}:{reviewerId}", score=timestamp

function parseStored<T>(
  raw: string | null | undefined,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  context: string,
): T | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn(`[shadow-mod] corrupt JSON at ${context}; ignoring`);
    return null;
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    console.warn(`[shadow-mod] schema mismatch at ${context}; ignoring`);
    return null;
  }
  return result.data ?? null;
}

// Sorted-set members are stored as "{postId}:{entityId}". Returns null when the
// member is malformed (missing separator) so callers can filter it out.
function splitMember(member: string): [postId: string, entityId: string] | null {
  const idx = member.indexOf(':');
  return idx >= 0 ? [member.slice(0, idx), member.slice(idx + 1)] : null;
}

// --- Observer decisions ---

/**
 * Persists an Observer's decision and adds it to the pending sorted set.
 * The chosen action is stored but never executed against the post.
 */
export async function saveObserverDecision(d: ObserverDecision): Promise<void> {
  const validated = ObserverDecisionSchema.parse(d);
  await redis.set(observerKey(validated.postId, validated.observerId), JSON.stringify(validated));
  await redis.zAdd(pendingKey(), {
    member: `${validated.postId}:${validated.observerId}`,
    score: Date.now(),
  });
}

/**
 * Retrieves a single Observer decision by post and observer ID.
 * Returns null on a cache miss, corrupt JSON, or schema mismatch.
 */
export async function getObserverDecision(
  postId: string,
  observerId: string,
): Promise<ObserverDecision | null> {
  const raw = await redis.get(observerKey(postId, observerId));
  return parseStored<ObserverDecision>(
    raw,
    ObserverDecisionSchema,
    `observer:${postId}:${observerId}`,
  );
}

/**
 * Transitions the status of an existing Observer decision.
 * No-ops silently if no decision exists for the given post and observer.
 */
export async function updateObserverStatus(
  postId: string,
  observerId: string,
  status: DecisionStatus,
): Promise<void> {
  const existing = await getObserverDecision(postId, observerId);
  if (!existing) return;
  const next = ObserverDecisionSchema.parse({ ...existing, status });
  await redis.set(observerKey(postId, observerId), JSON.stringify(next));
}

/**
 * Returns all Observer decisions for a post that are present in the pending sorted set,
 * regardless of status. Callers filter by status as needed.
 */
export async function getPendingForPost(postId: string): Promise<ObserverDecision[]> {
  const { members } = await redis.zScan(pendingKey(), 0, `${postId}:*`, 100);
  const observerIds = members
    .map(({ member }) => splitMember(member)?.[1])
    .filter((id): id is string => !!id);
  const decisions = await Promise.all(observerIds.map((id) => getObserverDecision(postId, id)));
  return decisions.filter((d): d is ObserverDecision => d !== null);
}

/**
 * Returns all posts that have at least one `pending_review` observation,
 * along with the display names of their Observers.
 * Used to populate the Reviewer queue form.
 */
export async function getAllPending(): Promise<{ postId: string; observerNames: string[] }[]> {
  const { members } = await redis.zScan(pendingKey(), 0, '*', 1000);
  const pairs = members
    .map(({ member }) => splitMember(member))
    .filter((pair): pair is [string, string] => pair !== null);

  const decisions = await Promise.all(
    pairs.map(([postId, observerId]) => getObserverDecision(postId, observerId)),
  );

  const byPost = new Map<string, string[]>();
  for (let i = 0; i < pairs.length; i++) {
    const [postId] = pairs[i]!;
    const d = decisions[i];
    if (!d || d.status !== 'pending_review') continue;
    const names = byPost.get(postId) ?? [];
    names.push(d.observerName);
    byPost.set(postId, names);
  }

  return Array.from(byPost.entries()).map(([postId, observerNames]) => ({ postId, observerNames }));
}

/**
 * Returns true if an Observer decision already exists for the given post and user.
 * Used to prevent duplicate observations on the same post.
 */
export async function hasObserverDecision(postId: string, observerId: string): Promise<boolean> {
  return Boolean(await redis.get(observerKey(postId, observerId)));
}

/**
 * Removes an entry from the pending sorted set, typically after a report is delivered.
 * Does not delete the underlying Observer decision record.
 */
export async function removePending(postId: string, observerId: string): Promise<void> {
  await redis.zRem(pendingKey(), [`${postId}:${observerId}`]);
}

// --- Reviewer decisions ---

/**
 * Persists a Reviewer's decision and adds it to the reviewers sorted set.
 */
export async function saveReviewerDecision(d: ReviewerDecision): Promise<void> {
  const validated = ReviewerDecisionSchema.parse(d);
  await redis.set(reviewerKey(validated.postId, validated.reviewerId), JSON.stringify(validated));
  await redis.zAdd(reviewersKey(), {
    member: `${validated.postId}:${validated.reviewerId}`,
    score: Date.now(),
  });
}

/**
 * Retrieves a single Reviewer decision by post and reviewer ID.
 * Returns null on a cache miss, corrupt JSON, or schema mismatch.
 */
export async function getReviewerDecision(
  postId: string,
  reviewerId: string,
): Promise<ReviewerDecision | null> {
  const raw = await redis.get(reviewerKey(postId, reviewerId));
  return parseStored<ReviewerDecision>(
    raw,
    ReviewerDecisionSchema,
    `reviewer:${postId}:${reviewerId}`,
  );
}

/**
 * Returns all Reviewer decisions recorded for a post, in no guaranteed order.
 * When multiple Reviewers exist, the report consumer picks the most recently added one.
 */
export async function getReviewerDecisionsForPost(postId: string): Promise<ReviewerDecision[]> {
  const { members } = await redis.zScan(reviewersKey(), 0, `${postId}:*`, 100);
  const reviewerIds = members
    .map(({ member }) => splitMember(member)?.[1])
    .filter((id): id is string => !!id);
  const decisions = await Promise.all(reviewerIds.map((id) => getReviewerDecision(postId, id)));
  return decisions.filter((d): d is ReviewerDecision => d !== null);
}

// --- Form sessions ---
// Bridges postId/username from the menu handler to the form submit handler.
// Devvit does not re-send the devvit-post header on form submission requests.

type FormSession = { postId: string; userId: string; username: string };
const formSessionKey = (userId: string) => `form-session:${userId}`;

/**
 * Stores a form session with a 5-minute TTL.
 * Necessary because Devvit does not forward the `devvit-post` header to form submit requests,
 * so the submit handler cannot read `context.postId` directly.
 */
export async function storeFormSession(session: FormSession): Promise<void> {
  const key = formSessionKey(session.userId);
  const expiration = new Date(Date.now() + 5 * 60 * 1000); // 5-minute TTL
  await redis.set(key, JSON.stringify(session), { expiration });
}

/**
 * Retrieves a previously stored form session.
 * Returns null if the session has expired, never existed, or contains invalid JSON.
 */
export async function getFormSession(userId: string): Promise<FormSession | null> {
  const raw = await redis.get(formSessionKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FormSession;
  } catch {
    return null;
  }
}

// --- Stats ---

/**
 * Increments the Observer's lifetime totals after a report is delivered.
 * Increments both `total` and either `correct` or `wrong` depending on agreement.
 */
export async function incrementStats(userId: string, agreed: boolean): Promise<void> {
  const key = `stats:${userId}`;
  await redis.hIncrBy(key, 'total', 1);
  await redis.hIncrBy(key, agreed ? 'correct' : 'wrong', 1);
}

/**
 * Returns the Observer's raw stats hash from Redis.
 * Fields: `total`, `correct`, `wrong`. All values are stored as strings by Redis hashes.
 */
export async function getStats(userId: string): Promise<Record<string, string>> {
  return (await redis.hGetAll(`stats:${userId}`)) ?? {};
}
