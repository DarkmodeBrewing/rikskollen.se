import { setTimeout as delay } from 'node:timers/promises';
import { createDatabaseClient } from '@rikskollen/db';
import type { ImportJob } from '@rikskollen/shared-types';
import { syncPersons } from './sync-persons';
import { syncVotes } from './sync-votes';
import { syncReportCatalog } from './sync-report-catalog';
import { syncCatalogDecisions } from './sync-catalog-decisions';
import { refreshDecisions } from './refresh-decisions';
import { withImportLock, ImportBusyError } from './lib/import-lock';

const HOUR = 3600000;
export const scheduledJobs = [
  { job: 'persons', interval: 24 * HOUR },
  { job: 'votes', interval: 24 * HOUR },
  { job: 'report-catalog', interval: 24 * HOUR },
  { job: 'catalog-decisions', interval: HOUR },
  { job: 'refresh-decisions', interval: 24 * HOUR },
] as const;
export interface LastAttempt {
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
}
export function isDue(
  attempt: LastAttempt | undefined,
  now: Date,
  interval: number,
): boolean {
  if (!attempt) return true;
  // A crashed process leaves running/unknown. Retry after an hour once the
  // database lock is free; failure never makes a published snapshot fresher.
  const anchor = attempt.finishedAt ?? attempt.startedAt;
  return (
    now.getTime() - anchor.getTime() >=
    (attempt.status === 'succeeded' ? interval : HOUR)
  );
}
export function batchLimit(
  value = process.env['IMPORT_BATCH_LIMIT'] ?? '10',
): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new Error('IMPORT_BATCH_LIMIT must be an integer between 1 and 25');
  return limit;
}
export async function runDueJobs(
  latest: Partial<Record<ImportJob, LastAttempt>>,
  run: (job: (typeof scheduledJobs)[number]['job']) => Promise<unknown>,
  now = new Date(),
) {
  const results: { job: ImportJob; status: 'succeeded' | 'failed' }[] = [];
  for (const { job, interval } of scheduledJobs) {
    if (!isDue(latest[job], now, interval)) continue;
    try {
      await run(job);
      results.push({ job, status: 'succeeded' });
    } catch (error) {
      console.error(`Scheduled ${job} failed`, error);
      results.push({ job, status: 'failed' });
    }
  }
  return results;
}
export async function scheduledPass(
  limit = batchLimit(),
  run?: (job: (typeof scheduledJobs)[number]['job']) => Promise<unknown>,
) {
  batchLimit(String(limit));
  return withImportLock(async () => {
    const { pgPool } = createDatabaseClient();
    let latest: Partial<Record<ImportJob, LastAttempt>>;
    try {
      const result = await pgPool.query<LastAttempt & { job: ImportJob }>(`
        SELECT DISTINCT ON (job) job, status, started_at AS "startedAt", finished_at AS "finishedAt"
        FROM import_attempts WHERE (session = '2025/26' OR (job = 'persons' AND session IS NULL))
        ORDER BY job, started_at DESC, id DESC`);
      latest = Object.fromEntries(result.rows.map((row) => [row.job, row]));
    } finally {
      await pgPool.end();
    }
    return runDueJobs(
      latest,
      run ??
        ((job) => {
          switch (job) {
            case 'persons':
              return syncPersons();
            case 'votes':
              return syncVotes(undefined, true);
            case 'report-catalog':
              return syncReportCatalog();
            case 'catalog-decisions':
              return syncCatalogDecisions(limit, undefined, true);
            case 'refresh-decisions':
              return refreshDecisions(limit);
          }
        }),
    );
  }, true);
}
async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => arg !== '--once' && arg !== '--check') ||
    args.length > 1
  )
    throw new Error('Usage: scheduler.js [--once | --check]');
  const limit = batchLimit();
  if (process.argv.includes('--check')) {
    console.log(
      JSON.stringify({
        batchLimit: limit,
        tickSeconds: 900,
        maxPassSeconds: 1800,
        jobs: scheduledJobs,
      }),
    );
    return;
  }
  const once = process.argv.includes('--once');
  const stop = new AbortController();
  process.once('SIGTERM', () => stop.abort());
  process.once('SIGINT', () => stop.abort());
  do {
    // No unbounded job: termination disconnects the session lock and preserves
    // completed snapshots. A timed-out attempt remains visibly unfinished.
    const deadline = setTimeout(
      () => {
        console.error('Scheduled pass exceeded 30 minutes');
        process.exit(1);
      },
      30 * 60 * 1000,
    );
    try {
      const results = await scheduledPass(limit);
      console.log(JSON.stringify({ event: 'scheduled-pass', results }));
      if (once && results.some((result) => result.status === 'failed'))
        process.exitCode = 1;
    } catch (error) {
      if (error instanceof ImportBusyError)
        console.log(
          JSON.stringify({ event: 'scheduled-pass', status: 'busy' }),
        );
      else {
        console.error(error);
        if (once) process.exitCode = 1;
      }
    } finally {
      clearTimeout(deadline);
    }
    if (once || stop.signal.aborted) break;
    try {
      await delay(15 * 60 * 1000, undefined, { signal: stop.signal });
    } catch (error) {
      if (!stop.signal.aborted) throw error;
    }
  } while (!stop.signal.aborted);
}
if (
  process.argv[1]?.endsWith('scheduler.js') ||
  process.argv[1]?.endsWith('scheduler.ts')
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
