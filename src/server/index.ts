import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { cron } from './routes/cron.js';
import { forms } from './routes/forms.js';
import { menu } from './routes/menu.js';
import { triggers } from './routes/triggers.js';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);
internal.route('/cron', cron);

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
