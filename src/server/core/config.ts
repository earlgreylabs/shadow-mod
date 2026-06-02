import { redis, settings } from '@devvit/web/server';
import type { AppConfig } from '@/shared/types.js';
import { AppConfigSchema } from '@/shared/schemas.js';

const CONFIG_KEY = 'config:reviewers';
const EMPTY_CONFIG: AppConfig = { reviewers: [] };

/**
 * Reads the subreddit's ShadowMod configuration from Devvit installation settings.
 * Falls back to Redis for backward compatibility if settings are empty.
 */
export async function getConfig(): Promise<AppConfig> {
  const reviewersRaw = (await settings.get('reviewers')) as string | undefined;
  if (reviewersRaw) {
    const reviewers = reviewersRaw
      .split(',')
      .map((s) => s.trim().replace(/^u\//i, ''))
      .filter(Boolean);
    return { reviewers };
  }

  // Fallback to Redis
  const raw = await redis.get(CONFIG_KEY);
  if (!raw) return EMPTY_CONFIG;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = AppConfigSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Ignore and return empty config
  }
  return EMPTY_CONFIG;
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
