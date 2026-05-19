import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { generateReport } from '../core/reports.js';
import type { ReportJobData } from '@/shared/types.js';

export const cron = new Hono();

cron.post('/generate-report', async (c) => {
  const { data } = await c.req.json<{ data: ReportJobData }>();

  if (!data?.postId || !data?.observerId) {
    console.error('generate-report: missing job data', data);
    return c.json({}, 200);
  }

  await generateReport(data, context.subredditName);

  return c.json({}, 200);
});
