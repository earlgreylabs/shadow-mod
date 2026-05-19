import { redis } from '@devvit/web/server';
import type { AppConfig } from '@/shared/types.js';
import { AppConfigSchema } from '@/shared/schemas.js';

const CONFIG_KEY = 'config:reviewers';
const EMPTY_CONFIG: AppConfig = { reviewers: [] };

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

export async function setConfig(config: AppConfig): Promise<void> {
  const validated = AppConfigSchema.parse(config);
  await redis.set(CONFIG_KEY, JSON.stringify(validated));
}

export async function isReviewer(username: string): Promise<boolean> {
  const config = await getConfig();
  return config.reviewers.map((u) => u.toLowerCase()).includes(username.toLowerCase());
}
