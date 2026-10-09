import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DataStatus, PublicImportAttempt } from '@rikskollen/shared-types';
import {
  evaluateStatus,
  monitorConfig,
  monitorPass,
  observe,
  parseStatus,
  transitions,
} from './monitor';

const now = Date.now();
const config = monitorConfig({ MONITOR_BASE_URL: 'http://fixture.invalid' });
const attempt = (job: string, changes = {}): PublicImportAttempt =>
  ({
    id: job,
    job,
    session: job === 'persons' ? null : '2025/26',
    dataset: 'votes',
    status: 'succeeded',
    trigger: 'scheduled',
    unchanged: true,
    expectedCount: 1,
    importedCount: 0,
    snapshotId: 'snapshot',
    documentId: null,
    startedAt: new Date(now - 2000).toISOString(),
    finishedAt: new Date(now - 1000).toISOString(),
    durationSeconds: 1,
    ...changes,
  }) as PublicImportAttempt;
const data = (): DataStatus => ({
  generatedAt: new Date(now).toISOString(),
  trackingStartedAt: null,
  latestAttempts: [
    'persons',
    'votes',
    'report-catalog',
    'catalog-decisions',
    'refresh-decisions',
  ].map((job) => attempt(job)),
  coverage: ['members', 'votes', 'catalog', 'decisions'].map((dataset) => ({
    dataset,
    session: dataset === 'members' ? null : '2025/26',
    complete: dataset !== 'decisions',
    expectedCount: 474,
    importedCount: dataset === 'decisions' ? 28 : 474,
    lastSuccessfulAt: '2020-01-01T00:00:00Z',
  })) as DataStatus['coverage'],
  history: { items: [], total: 0, page: 1, limit: 20 },
});
test('fresh unchanged checks and partial decision backfill are healthy despite old publication', () => {
  assert.deepEqual(evaluateStatus(data(), [], config, now), []);
});
test('failed job remains unresolved during retry, then recovers only after success', () => {
  const d = data();
  d.latestAttempts[1] = attempt('votes', { status: 'failed' });
  const failed = evaluateStatus(d, [], config, now);
  assert.equal(failed[0].key, 'job:votes');
  d.latestAttempts[1] = attempt('votes', {
    status: 'running',
    finishedAt: null,
  });
  assert.deepEqual(evaluateStatus(d, failed, config, now), failed);
  d.latestAttempts[1] = attempt('votes');
  assert.equal(
    transitions(failed, evaluateStatus(d, failed, config, now))[0].outcome,
    'recovery',
  );
});
test('overdue checks, abandoned attempts, missing jobs and incomplete snapshots raise incidents', () => {
  const d = data();
  d.latestAttempts[1] = attempt('votes', {
    startedAt: new Date(now - 28 * 3600000).toISOString(),
    finishedAt: new Date(now - 27 * 3600000).toISOString(),
  });
  d.latestAttempts[3] = attempt('catalog-decisions', {
    status: 'running',
    finishedAt: null,
    startedAt: new Date(now - 46 * 60000).toISOString(),
  });
  d.latestAttempts.pop();
  d.coverage[0].complete = false;
  assert.deepEqual(
    evaluateStatus(d, [], config, now).map((i) => i.key),
    [
      'job:votes',
      'job:catalog-decisions',
      'job:refresh-decisions',
      'coverage:members',
    ],
  );
});
test('malformed/stale responses and endpoint failure cannot resolve existing incidents', async () => {
  const previous = [{ key: 'job:votes', reason: 'failed' }];
  const d = data();
  d.generatedAt = '2020-01-01';
  assert.throws(() => parseStatus(d, now));
  const result = await observe(
    config,
    previous,
    async () => new Response('{}', { status: 503 }),
    now,
  );
  assert.deepEqual(
    result.map((i) => i.key),
    ['job:votes', 'endpoint'],
  );
  const huge = await observe(
    config,
    previous,
    async (input) =>
      new Response(
        String(input).endsWith('/health') ? '{}' : 'x'.repeat(1_048_577),
      ),
    now,
  );
  assert.equal(huge[huge.length - 1]?.key, 'endpoint');
});
test('durable webhook retry keeps delivery ID across restart, deduplicates and sends recovery', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rikskollen-monitor-'));
  const c = {
    ...config,
    stateFile: join(folder, 'state.json'),
    webhookUrl: 'https://receiver.invalid',
  };
  let d = data();
  d.latestAttempts[1] = attempt('votes', { status: 'failed' });
  let reject = true;
  const deliveries: { deliveryId: string; events: { outcome: string }[] }[] =
    [];
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input) === c.webhookUrl) {
      deliveries.push(JSON.parse(String(init?.body)));
      return new Response('', { status: reject ? 503 : 200 });
    }
    return new Response(
      String(input).endsWith('/health') ? '{}' : JSON.stringify(d),
    );
  };
  try {
    await assert.rejects(monitorPass(c, fetcher));
    const pending = JSON.parse(await readFile(c.stateFile, 'utf8'));
    assert.ok(pending.pending);
    reject = false;
    assert.equal(await monitorPass(c, fetcher), 1);
    assert.equal(deliveries[0].deliveryId, deliveries[1].deliveryId);
    assert.equal(await monitorPass(c, fetcher), 1);
    assert.equal(deliveries.length, 2);
    d = data();
    assert.equal(await monitorPass(c, fetcher), 0);
    assert.equal(deliveries[2].events[0].outcome, 'recovery');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test('invalid URLs and thresholds are rejected without exposing configuration', () => {
  assert.throws(() =>
    monitorConfig({
      MONITOR_WEBHOOK_URL: 'https://secret:password@example.invalid',
    }),
  );
  assert.throws(() => monitorConfig({ MONITOR_RUNNING_MINUTES: '0' }));
});
test('invalid state and overlapping passes fail without webhook delivery or state reset', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'rikskollen-monitor-invalid-'));
  const c = { ...config, stateFile: join(folder, 'state.json') };
  const { writeFile, mkdir } = await import('node:fs/promises');
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return new Response('{}');
  };
  try {
    await writeFile(c.stateFile, 'corrupt');
    await assert.rejects(monitorPass(c, fetcher), /Cannot read/);
    assert.equal(await readFile(c.stateFile, 'utf8'), 'corrupt');
    await mkdir(`${c.stateFile}.lock`);
    await assert.rejects(monitorPass(c, fetcher), /locked/);
    assert.equal(calls, 0);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test('endpoint recovery clears only endpoint incident; incomplete imports remain', async () => {
  const previous = [
    { key: 'endpoint', reason: 'unavailable' },
    { key: 'job:votes', reason: 'failed' },
  ];
  const d = data();
  d.latestAttempts[1] = attempt('votes', {
    status: 'running',
    finishedAt: null,
  });
  const result = await observe(
    config,
    previous,
    async (input) =>
      new Response(
        String(input).endsWith('/health') ? '{}' : JSON.stringify(d),
      ),
    now,
  );
  assert.deepEqual(
    result.map((i) => i.key),
    ['job:votes'],
  );
  assert.deepEqual(
    transitions(previous, result).map((i) => [i.key, i.outcome]),
    [['endpoint', 'recovery']],
  );
});
test(
  'CI HTTP receiver verifies failure/retry/recovery delivery over real sockets',
  { skip: !process.env['CI'] },
  async () => {
    const { createServer } = await import('node:http');
    const folder = await mkdtemp(join(tmpdir(), 'rikskollen-monitor-http-'));
    let d = data();
    d.latestAttempts[1] = attempt('votes', { status: 'failed' });
    let reject = true;
    const deliveries: { deliveryId: string; events: { outcome: string }[] }[] =
      [];
    const server = createServer(async (req, res) => {
      if (req.url === '/webhook') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const payload = JSON.parse(body);
        deliveries.push(payload);
        assert.equal(req.headers['idempotency-key'], payload.deliveryId);
        res.writeHead(reject ? 503 : 200);
        res.end();
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(req.url === '/health' ? '{}' : JSON.stringify(d));
      }
    });
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const port = (server.address() as { port: number }).port;
      const baseUrl = `http://127.0.0.1:${port}`;
      const c = {
        ...config,
        baseUrl,
        webhookUrl: `${baseUrl}/webhook`,
        stateFile: join(folder, 'state.json'),
      };
      await assert.rejects(monitorPass(c));
      reject = false;
      await monitorPass(c);
      assert.equal(deliveries[0].deliveryId, deliveries[1].deliveryId);
      d = data();
      await monitorPass(c);
      assert.equal(deliveries[2].events[0].outcome, 'recovery');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(folder, { recursive: true, force: true });
    }
  },
);
