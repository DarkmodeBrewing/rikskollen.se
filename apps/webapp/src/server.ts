import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const apiBaseUrl = process.env['API_BASE_URL'] || 'http://localhost:3000';

// Staging readiness checks the SSR process, internal API and migrated database.
app.get('/health', async (_req, res) => {
  try {
    const upstream = await fetch(new URL('/ready', apiBaseUrl), {
      signal: AbortSignal.timeout(3000),
    });
    res.status(upstream.ok ? 200 : 503).json({ ok: upstream.ok });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Same-origin API proxy for the production SSR server.
app.use('/api', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const upstream = await fetch(
      new URL(req.originalUrl, apiBaseUrl),
      { method: req.method, signal: AbortSignal.timeout(10_000) },
    );
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.send(await upstream.text());
  } catch {
    res.status(502).json({ error: 'API unavailable' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
