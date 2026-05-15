import { redis } from '@devvit/web/server';
import type { AppConfig } from '../../shared/types.js';

const CONFIG_KEY = 'config:seniorMods';

export async function getConfig(): Promise<AppConfig> {
  const raw = await redis.get(CONFIG_KEY);
  if (!raw) return { seniorMods: [] };
  return JSON.parse(raw) as AppConfig;
}

export async function setConfig(config: AppConfig): Promise<void> {
  await redis.set(CONFIG_KEY, JSON.stringify(config));
}

export async function isSeniorMod(username: string): Promise<boolean> {
  const config = await getConfig();
  return config.seniorMods.map(u => u.toLowerCase()).includes(username.toLowerCase());
}
