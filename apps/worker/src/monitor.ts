import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { DataStatus, PublicImportAttempt } from '@rikskollen/shared-types';

const HOUR = 3_600_000;
export const monitoredJobs = [
  'persons',
  'votes',
  'report-catalog',
  'catalog-decisions',
  'refresh-decisions',
] as const;
export interface Incident {
  key: string;
  reason: string;
  attemptId?: string;
}
export interface AlertEvent extends Incident {
  outcome: 'failure' | 'recovery';
}
export interface PendingAlert {
  id: string;
  events: AlertEvent[];
  nextActive: Incident[];
}
export interface MonitorState {
  version: 1;
  active: Incident[];
  pending?: PendingAlert;
}
export interface MonitorConfig {
  baseUrl: string;
  webhookUrl?: string;
  stateFile: string;
  tickSeconds: number;
  dailyHours: number;
  batchHours: number;
  runningMinutes: number;
}
export function monitorConfig(env = process.env): MonitorConfig {
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`Invalid ${key}`);
    return value;
  };
  const url = (value: string) => {
    const parsed = new URL(value);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      throw new Error(
        'Monitor URLs must be HTTP(S), without credentials, query or fragment',
      );
    return value.replace(/\/$/, '');
  };
  return {
    baseUrl: url(env['MONITOR_BASE_URL'] ?? 'http://web:4000'),
    // The webhook URL is secret configuration; never include it in logs/state.
    webhookUrl: env['MONITOR_WEBHOOK_URL']
      ? url(env['MONITOR_WEBHOOK_URL'])
      : undefined,
    stateFile: env['MONITOR_STATE_FILE'] ?? '/app/monitor-state/state.json',
    tickSeconds: number('MONITOR_TICK_SECONDS', 300, 10, 3600),
    dailyHours: number('MONITOR_DAILY_HOURS', 26, 1, 168),
    batchHours: number('MONITOR_BATCH_HOURS', 3, 1, 168),
    runningMinutes: number('MONITOR_RUNNING_MINUTES', 45, 30, 1440),
  };
}
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
export function parseStatus(value: unknown, now: number): DataStatus {
  const data = value as DataStatus;
  if (
    !data ||
    !timestamp(data.generatedAt) ||
    now - Date.parse(data.generatedAt) > 120_000 ||
    Date.parse(data.generatedAt) - now > 300_000 ||
    !Array.isArray(data.latestAttempts) ||
    !Array.isArray(data.coverage)
  )
    throw new Error('Invalid or stale status response');
  for (const a of data.latestAttempts) {
    if (
      !a ||
      typeof a.id !== 'string' ||
      typeof a.job !== 'string' ||
      !['running', 'succeeded', 'failed'].includes(a.status) ||
      !timestamp(a.startedAt) ||
      (a.finishedAt !== null && !timestamp(a.finishedAt)) ||
      (a.status !== 'running' && a.finishedAt === null) ||
      !['manual', 'scheduled'].includes(a.trigger) ||
      typeof a.unchanged !== 'boolean' ||
      Date.parse(a.startedAt) > now + 300_000 ||
      (a.finishedAt &&
        (Date.parse(a.finishedAt) > now + 300_000 ||
          Date.parse(a.finishedAt) < Date.parse(a.startedAt)))
    )
      throw new Error('Invalid attempt response');
  }
  if (
    new Set(data.latestAttempts.map((a) => a.job)).size !==
    data.latestAttempts.length
  )
    throw new Error('Duplicate latest job');
  for (const c of data.coverage) {
    if (
      !c ||
      typeof c.dataset !== 'string' ||
      typeof c.complete !== 'boolean' ||
      !Number.isInteger(c.expectedCount) ||
      c.expectedCount < 0 ||
      !Number.isInteger(c.importedCount) ||
      c.importedCount < 0 ||
      (c.complete && c.importedCount !== c.expectedCount)
    )
      throw new Error('Invalid coverage response');
  }
  return data;
}
export function evaluateStatus(
  data: DataStatus,
  previous: Incident[],
  config: MonitorConfig,
  now: number,
): Incident[] {
  const incidents: Incident[] = [];
  for (const job of monitoredJobs) {
    const key = `job:${job}`;
    const a: PublicImportAttempt | undefined = data.latestAttempts.find(
      (a) =>
        a.job === job &&
        (job === 'persons' ? a.session === null : a.session === '2025/26'),
    );
    if (!a) {
      incidents.push({ key, reason: 'No recorded check for expected job' });
      continue;
    }
    if (a.status === 'failed')
      incidents.push({
        key,
        reason: 'Latest import attempt failed',
        attemptId: a.id,
      });
    else if (a.status === 'running') {
      if (now - Date.parse(a.startedAt) > config.runningMinutes * 60_000)
        incidents.push({
          key,
          reason: 'Import has no final outcome beyond running threshold',
          attemptId: a.id,
        });
      else {
        // A retry beginning does not prove recovery from the preceding failure.
        const unresolved = previous.find((i) => i.key === key);
        if (unresolved) incidents.push(unresolved);
      }
    } else if (
      now - Date.parse(a.finishedAt!) >
      (job === 'catalog-decisions' ? config.batchHours : config.dailyHours) *
        HOUR
    )
      incidents.push({
        key,
        reason: 'Latest successful check is overdue',
        attemptId: a.id,
      });
  }
  for (const dataset of ['members', 'votes', 'catalog']) {
    const c = data.coverage.find(
      (c) =>
        c.dataset === dataset &&
        (dataset === 'members' ? c.session === null : c.session === '2025/26'),
    );
    if (!c || !c.complete)
      incidents.push({
        key: `coverage:${dataset}`,
        reason: 'Published snapshot missing or incomplete',
      });
  }
  // Decision coverage is deliberately partial during bounded backfill. An
  // unchanged successful check is fresh even when its publication is old.
  return incidents;
}
export function transitions(
  previous: Incident[],
  current: Incident[],
): AlertEvent[] {
  return [
    ...current
      .filter((i) => !previous.some((p) => p.key === i.key))
      .map((i) => ({ ...i, outcome: 'failure' as const })),
    ...previous
      .filter((i) => !current.some((p) => p.key === i.key))
      .map((i) => ({ ...i, outcome: 'recovery' as const })),
  ];
}
export async function observe(
  config: MonitorConfig,
  previous: Incident[],
  fetcher = fetch,
  now = Date.now(),
): Promise<Incident[]> {
  try {
    const health = await fetcher(`${config.baseUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
    await health.body?.cancel();
    if (!health.ok) throw new Error('Health unavailable');
    const response = await fetcher(`${config.baseUrl}/api/data-status`, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) throw new Error('Status unavailable');
    // Bound the response before parsing; avoid pulling an unbounded error body.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty status');
    let body = '';
    let size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1_048_576) throw new Error('Status too large');
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel();
    }
    return evaluateStatus(
      parseStatus(JSON.parse(body), now),
      previous,
      config,
      now,
    );
  } catch {
    // An unavailable/malformed response cannot resolve known import incidents.
    return [
      ...previous.filter((i) => i.key !== 'endpoint'),
      {
        key: 'endpoint',
        reason: 'Health/status endpoint unavailable or invalid',
      },
    ];
  }
}
export async function saveState(path: string, state: MonitorState) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}
export async function deliverPending(
  state: MonitorState,
  config: MonitorConfig,
  fetcher = fetch,
): Promise<MonitorState> {
  if (!state.pending) return state;
  const payload = {
    event: 'rikskollen-monitor',
    deliveryId: state.pending.id,
    events: state.pending.events,
  };
  if (config.webhookUrl) {
    const response = await fetcher(config.webhookUrl, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': state.pending.id,
      },
      body: JSON.stringify(payload),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('Webhook delivery failed');
  }
  console.log(JSON.stringify(payload));
  return { version: 1, active: state.pending.nextActive };
}
export async function monitorPass(config: MonitorConfig, fetcher = fetch) {
  await mkdir(dirname(config.stateFile), { recursive: true, mode: 0o700 });
  const lock = `${config.stateFile}.lock`;
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('Monitor state is locked');
    throw error;
  }
  try {
    let state: MonitorState;
    try {
      state = JSON.parse(await readFile(config.stateFile, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Cannot read monitor state');
      state = { version: 1, active: [] };
    }
    const incidentsValid = (items: Incident[]) =>
      Array.isArray(items) &&
      items.every(
        (i) => i && typeof i.key === 'string' && typeof i.reason === 'string',
      ) &&
      new Set(items.map((i) => i.key)).size === items.length;
    if (
      state.version !== 1 ||
      !incidentsValid(state.active) ||
      (state.pending &&
        (!Array.isArray(state.pending.events) ||
          !state.pending.events.every(
            (e) =>
              e &&
              typeof e.key === 'string' &&
              typeof e.reason === 'string' &&
              ['failure', 'recovery'].includes(e.outcome),
          ) ||
          !incidentsValid(state.pending.nextActive) ||
          typeof state.pending.id !== 'string'))
    )
      throw new Error('Invalid monitor state');
    state = await deliverPending(state, config, fetcher);
    await saveState(config.stateFile, state);
    const current = await observe(config, state.active, fetcher);
    const events = transitions(state.active, current);
    if (events.length) {
      state.pending = {
        id: createHash('sha256').update(randomUUID()).digest('hex'),
        events,
        nextActive: current,
      };
      await saveState(config.stateFile, state); // Durable outbox before delivery.
      state = await deliverPending(state, config, fetcher);
    } else state.active = current;
    await saveState(config.stateFile, state);
    console.log(
      JSON.stringify({
        event: 'monitor-check',
        incidents: state.active.length,
      }),
    );
    return state.active.length;
  } finally {
    await rm(lock, { recursive: true });
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((a) => !['--once', '--check'].includes(a)))
    throw new Error('Usage: monitor.js [--once | --check]');
  const config = monitorConfig();
  if (args[0] === '--check') {
    console.log(
      JSON.stringify({
        event: 'monitor-config',
        tickSeconds: config.tickSeconds,
        dailyHours: config.dailyHours,
        batchHours: config.batchHours,
        runningMinutes: config.runningMinutes,
        webhookConfigured: !!config.webhookUrl,
      }),
    );
    return;
  }
  const stop = new AbortController();
  process.once('SIGTERM', () => stop.abort());
  process.once('SIGINT', () => stop.abort());
  do {
    try {
      const incidents = await monitorPass(config);
      if (args[0] === '--once') process.exitCode = incidents ? 1 : 0;
    } catch {
      console.error(
        JSON.stringify({
          event: 'monitor-error',
          reason:
            'State, lock or delivery failure; inspect configuration and receiver',
        }),
      );
      if (args[0] === '--once') process.exitCode = 2;
    }
    if (args[0] === '--once' || stop.signal.aborted) break;
    try {
      await delay(config.tickSeconds * 1000, undefined, {
        signal: stop.signal,
      });
    } catch {
      if (!stop.signal.aborted) throw new Error('Monitor delay failed');
    }
  } while (!stop.signal.aborted);
}
if (
  process.argv[1]?.endsWith('monitor.js') ||
  process.argv[1]?.endsWith('monitor.ts')
)
  main().catch(() => {
    console.error('Invalid monitor configuration');
    process.exitCode = 2;
  });
