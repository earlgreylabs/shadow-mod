import { redis } from '@devvit/web/server';
import type { AppConfig } from '@/shared/types.js';
import { AppConfigSchema } from '@/shared/schemas.js';

const CONFIG_KEY = 'config:reviewers';
const EMPTY_CONFIG: AppConfig = { reviewers: [] };

/**
 * Reads the subreddit's ShadowMod configuration from Redis.
 *
 * Returns an empty config on a cache miss, corrupt JSON, or schema mismatch —
 * logging a warning in the latter two cases rather than throwing.
 */
export async function getConfig(): Promise<AppConfig> {
  const raw = await redis.get(CONFIG_KEY);
  if (!raw) return EMPTY_CONFIG;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[shadow-mod] corrupt JSON at ${CONFIG_KEY}; returning empty config`);
    return EMPTY_CONFIG;
  }
  const result = AppConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(`[shadow-mod] schema mismatch at ${CONFIG_KEY}; returning empty config`);
    return EMPTY_CONFIG;
  }
  return result.data;
}

/**
 * Validates and persists the subreddit configuration to Redis.
 * Throws a Zod validation error if the shape does not satisfy the schema.
 */
export async function setConfig(config: AppConfig): Promise<void> {
  const validated = AppConfigSchema.parse(config);
  await redis.set(CONFIG_KEY, JSON.stringify(validated));
}

/**
 * Returns true if the username appears in the subreddit's Reviewer list.
 * Comparison is case-insensitive to match Reddit's username convention.
 */
export async function isReviewer(username: string): Promise<boolean> {
  const config = await getConfig();
  const lower = username.toLowerCase();
  return config.reviewers.some((u) => u.toLowerCase() === lower);
}
