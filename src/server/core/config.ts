import { redis } from '@devvit/web/server';
import type { AppConfig } from '../../shared/types.js';

const CONFIG_KEY = 'config:reviewers';

export async function getConfig(): Promise<AppConfig> {
  const raw = await redis.get(CONFIG_KEY);
  if (!raw) return { reviewers: [] };
  return JSON.parse(raw) as AppConfig;
}

export async function setConfig(config: AppConfig): Promise<void> {
  await redis.set(CONFIG_KEY, JSON.stringify(config));
}

export async function isReviewer(username: string): Promise<boolean> {
  const config = await getConfig();
  return config.reviewers.map(u => u.toLowerCase()).includes(username.toLowerCase());
}
