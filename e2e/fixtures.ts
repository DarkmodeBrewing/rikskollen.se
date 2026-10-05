import { test as base, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { member, events, history, trail, decisions, timestamp, dataStatus } from './data';

type Scenario = 'normal' | 'empty' | 'error' | 'missing' | 'no-context';
export interface FixtureApp {
  url: string;
  scenario: Scenario;
  unexpected: string[];
  requests: string[];
  delay: null | Promise<void>;
}
async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing fixture port');
  return `http://127.0.0.1:${address.port}`;
}
export const test = base.extend<{ app: FixtureApp }>({
  app: async ({}, use, testInfo) => {
    const app: FixtureApp = {
      url: '',
      scenario: 'normal',
      unexpected: [],
      requests: [],
      delay: null,
    };
    const api = createServer(async (req, res) => {
      const url = new URL(req.url!, 'http://fixture');
      const path = url.pathname;
      app.requests.push(req.url!);
      const page = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 30);
      const paged = <T>(items: T[]) => ({
        items: items.slice((page - 1) * limit, page * limit),
        total: items.length,
        page,
        limit,
      });
      let body: unknown;
      let status = 200;
      if (path === '/ready') body = { ok: true };
      else if (path === '/api/data-status') {
        const empty = app.scenario === 'empty';
        body = { ...dataStatus, coverage: empty ? [] : dataStatus.coverage,
          latestAttempts: empty ? [] : dataStatus.latestAttempts, trackingStartedAt: empty ? null : dataStatus.trackingStartedAt,
          history: { ...paged(empty ? [] : dataStatus.history.items), limit: 20,
            items: empty ? [] : dataStatus.history.items.slice((page-1)*20, page*20) } };
      }
      else if (path === '/api/import-status')
        body =
          app.scenario === 'empty'
            ? null
            : {
                expectedCount: 31,
                importedCount: 31,
                currentCount: 31,
                batchCount: 1,
                complete: true,
                completedAt: timestamp,
                sourceUrl: member.sourceUrl,
              };
      else if (path === '/api/votes/import-status')
        body =
          app.scenario === 'empty'
            ? null
            : {
                session: '2025/26',
                expectedFiles: 25,
                eventCount: 25,
                choiceCount: 25,
                complete: true,
                completedAt: timestamp,
                sourceUrl: history.summary!.sourceArchiveUrl,
              };
      else if (path === '/api/persons') {
        const q = url.searchParams.get('q') || '';
        const people = Array.from({ length: 31 }, (_, i) => ({
          ...member,
          personId: String(i + 1).padStart(13, '0'),
          lastName: i ? `Ledamot ${i + 1}` : member.lastName,
        }));
        body = paged(
          app.scenario === 'empty'
            ? []
            : people.filter((person) =>
                `${person.givenName} ${person.lastName}`
                  .toLowerCase()
                  .includes(q.toLowerCase()),
              ),
        );
      } else if (path === `/api/persons/${member.personId}`) body = member;
      else if (path === `/api/persons/${member.personId}/votes`) {
        const choice = url.searchParams.get('choice');
        const rows =
          app.scenario === 'empty'
            ? []
            : history.items.filter(
                (row) => choice === null || row.choice === choice,
              );
        body = {
          ...history,
          ...paged(rows),
          choice,
          summary: app.scenario === 'empty' ? null : history.summary,
        };
      } else if (path === '/api/votes')
        body = {
          ...paged(app.scenario === 'empty' ? [] : events),
          session: '2025/26',
        };
      else if (path === `/api/votes/${events[0].voteId}`)
        body = {
          event: events[0],
          decisionTrailAvailable: app.scenario !== 'no-context',
          choices: [
            {
              ...member,
              sourceName: 'Test Ledamot',
              choice: 'Ja',
              memberProfileAvailable: true,
            },
            {
              ...member,
              personId: '0000000000099',
              sourceName: 'Historisk Testperson',
              choice: 'Frånvarande',
              memberProfileAvailable: false,
            },
          ],
          counts: { Ja: 1, Frånvarande: 1 },
          total: 2,
          sourceArchiveUrl: history.summary!.sourceArchiveUrl,
          importedAt: timestamp,
        };
      else if (path === '/api/decisions')
        body =
          app.scenario === 'empty'
            ? {
                ...decisions,
                ...paged([]),
                catalogCoverage: null,
                decisionMethodSummary: null,
              }
            : { ...decisions, ...paged(decisions.items) };
      else if (path === '/api/decisions/TESTREPORT') body = trail;
      else {
        app.unexpected.push(req.url!);
        status = 501;
        body = { error: 'Unexpected fixture request' };
      }
      if (path.startsWith('/api/') && app.scenario === 'error') {
        status = 503;
        body = { error: 'Synthetic API outage' };
      }
      if (
        app.scenario === 'missing' &&
        /^\/api\/(persons|votes|decisions)\//.test(path) &&
        !path.endsWith('import-status')
      ) {
        status = 404;
        body = { error: 'Not found' };
      }
      if (path.startsWith('/api/') && app.delay) await app.delay;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    const apiUrl = await listen(api);
    // Let the OS allocate independent ports, including for parallel workers.
    const reservation = createServer();
    const webUrl = await listen(reservation);
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    const child = spawn(
      process.execPath,
      ['apps/webapp/dist/webapp/server/server.mjs'],
      {
        env: {
          ...process.env,
          API_BASE_URL: apiUrl,
          NG_ALLOWED_HOSTS: '127.0.0.1,localhost,test.rikskollen.invalid',
          PORT: new URL(webUrl).port,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let logs = '';
    child.stdout.on('data', (data) => (logs += data));
    child.stderr.on('data', (data) => (logs += data));
    app.url = webUrl;
    try {
      await expect
        .poll(
          async () => {
            if (child.exitCode !== null) throw new Error(logs);
            try {
              return (await fetch(`${webUrl}/health`)).status;
            } catch {
              return 0;
            }
          },
          { timeout: 15_000 },
        )
        .toBe(200);
      await use(app);
      expect(
        app.unexpected,
        'Unmapped API requests must fail, never call a live source',
      ).toEqual([]);
    } finally {
      await testInfo.attach('ssr.log', {
        body: logs,
        contentType: 'text/plain',
      });
      child.kill();
      if (child.exitCode === null && child.signalCode === null)
        await once(child, 'exit');
      api.closeAllConnections();
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  },
  baseURL: async ({ app }, use) => use(app.url),
  page: async ({ page, app }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      // HTTP failure diagnostics are expected only in explicit outage/404 tests.
      if (
        message.type() === 'error' &&
        !(
          (app.scenario === 'error' || app.scenario === 'missing') &&
          /Failed to load resource.*(404|503)/.test(message.text())
        )
      )
        errors.push(message.text());
    });
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === app.url)
        return route.continue();
      errors.push(`Unexpected browser network: ${route.request().url()}`);
      return route.abort();
    });
    await use(page);
    expect(errors, 'Browser errors/network escapes').toEqual([]);
  },
});
export { expect };
