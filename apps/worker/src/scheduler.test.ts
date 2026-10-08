import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batchLimit, isDue, runDueJobs, scheduledJobs } from './scheduler';
import { selectRefreshReports } from './refresh-decisions';
import { createDatabaseClient } from '@rikskollen/db';
import {
  IMPORT_LOCK_KEY,
  withImportLock,
  ImportBusyError,
} from './lib/import-lock';
import { syncDecision } from './sync-decisions';
import { decisionFixture } from './clients/decision-fixture';

const now = new Date('2026-10-08T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000);
test('due jobs use completion times, throttle failures and retry abandoned attempts', () => {
  assert.equal(isDue(undefined, now, 86400000), true);
  assert.equal(
    isDue(
      {
        status: 'succeeded',
        startedAt: hoursAgo(30),
        finishedAt: hoursAgo(23),
      },
      now,
      86400000,
    ),
    false,
  );
  assert.equal(
    isDue(
      {
        status: 'succeeded',
        startedAt: hoursAgo(30),
        finishedAt: hoursAgo(24),
      },
      now,
      86400000,
    ),
    true,
  );
  assert.equal(
    isDue(
      { status: 'failed', startedAt: hoursAgo(2), finishedAt: hoursAgo(0.5) },
      now,
      86400000,
    ),
    false,
  );
  assert.equal(
    isDue(
      { status: 'running', startedAt: hoursAgo(2), finishedAt: null },
      now,
      86400000,
    ),
    true,
  );
  for (const value of ['0', '26', '1.5', 'garbage'])
    assert.throws(() => batchLimit(value));
  assert.equal(batchLimit('25'), 25);
});
test('one failed source does not block other due jobs; fresh jobs are skipped', async () => {
  const calls: string[] = [];
  const results = await runDueJobs(
    { persons: { status: 'succeeded', startedAt: now, finishedAt: now } },
    async (job) => {
      calls.push(job);
      if (job === 'votes') throw new Error('fixture unavailable');
    },
    now,
  );
  assert.deepEqual(
    calls,
    scheduledJobs.map((row) => row.job).filter((job) => job !== 'persons'),
  );
  assert.equal(results.find((row) => row.job === 'votes')?.status, 'failed');
  assert.equal(results[results.length - 1]?.status, 'succeeded');
});
test('bounded correction selection balances recent and old reports using last successful check', () => {
  const rows = [
    {
      documentId: 'HD01TU1',
      sourceDate: '2026-10-01',
      checkedAt: hoursAgo(48),
    },
    {
      documentId: 'HD01TU2',
      sourceDate: '2026-10-02',
      checkedAt: hoursAgo(30),
    },
    { documentId: 'HD01TU3', sourceDate: null, checkedAt: hoursAgo(240) },
    {
      documentId: 'HD01TU4',
      sourceDate: '2025-10-01',
      checkedAt: hoursAgo(200),
    },
    {
      documentId: 'HD01TU5',
      sourceDate: '2025-10-01',
      checkedAt: hoursAgo(24),
    },
    { documentId: 'HD01TU6', sourceDate: '2026-10-07', checkedAt: hoursAgo(1) },
  ];
  assert.deepEqual(selectRefreshReports(rows, now, 2), ['HD01TU1', 'HD01TU3']);
  assert.deepEqual(
    new Set(selectRefreshReports(rows, now, 10)),
    new Set(['HD01TU1', 'HD01TU2', 'HD01TU3', 'HD01TU4']),
  );
  assert.deepEqual(
    selectRefreshReports(
      rows.filter((r) => !r.sourceDate?.startsWith('2026')),
      now,
      2,
    ),
    ['HD01TU3', 'HD01TU4'],
  );
  const nextDay = new Date(now.getTime() + 86400000);
  assert.equal(
    new Set([
      ...selectRefreshReports(rows, now, 1),
      ...selectRefreshReports(rows, nextDay, 1),
    ]).size,
    2,
  );
  assert.throws(() => selectRefreshReports(rows, now, 26));
  assert.throws(
    () => selectRefreshReports([...rows, rows[0]], now, 10),
    /Duplicate/,
  );
});
test(
  'database lock rejects other sessions before fetching and permits nested imports',
  { skip: !process.env.DATABASE_URL || process.env['PGLITE_CHECK'] === '1' },
  async () => {
    const { pgPool } = createDatabaseClient();
    const client = await pgPool.connect();
    let fetched = false;
    try {
      await client.query('SELECT pg_advisory_lock($1)', [IMPORT_LOCK_KEY]);
      await assert.rejects(
        syncDecision('HD01TU8', async () => {
          fetched = true;
          return decisionFixture;
        }),
        ImportBusyError,
      );
      assert.equal(fetched, false);
      await client.query('SELECT pg_advisory_unlock($1)', [IMPORT_LOCK_KEY]);
      await withImportLock(() =>
        withImportLock(async () => {
          fetched = true;
        }),
      );
      assert.equal(fetched, true);
      await assert.rejects(
        withImportLock(async () => {
          throw new Error('fixture failure');
        }),
        /fixture failure/,
      );
      // Failure releases the lock, allowing the next process/pass to proceed.
      await withImportLock(async () => {});
    } finally {
      await client.query('SELECT pg_advisory_unlock_all()');
      client.release();
      await pgPool.end();
    }
  },
);

test(
  'scheduled corrections preserve failures, publish changed reports and record unchanged checks',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { refreshDecisions } = await import('./refresh-decisions');
    const { pgPool } = createDatabaseClient();
    const before = (
      await pgPool.query('SELECT id FROM import_attempts')
    ).rows.map((row) => row.id);
    let catalogId: string | undefined;
    const fixture = (id: string) =>
      decisionFixture.replace(/HD01TU8/g, id).replace(/TU8/g, id.slice(4));
    try {
      const catalog =
        await pgPool.query(`INSERT INTO report_catalog_runs (session,source_url,source_hash,expected_count,page_count,completed_at)
      VALUES ('2025/26','fixture','fixture',2,1,'2030-01-01') RETURNING id`);
      catalogId = catalog.rows[0].id;
      await pgPool.query(
        "INSERT INTO report_catalog_pages (run_id,page,source_url,source_hash,item_count) VALUES ($1,1,'fixture','fixture',2)",
        [catalogId],
      );
      await pgPool.query(
        `INSERT INTO report_catalog_entries (run_id,document_id,designation,title,page,source_date) VALUES
      ($1,'HD01TU991','TU991','Fixture first',1,'2025-01-01'),($1,'HD01TU992','TU992','Fixture second',1,NULL)`,
        [catalogId],
      );
      for (const id of ['HD01TU991', 'HD01TU992']) {
        await syncDecision(id, async () => fixture(id));
        await pgPool.query(
          "UPDATE decision_import_runs SET completed_at = '2025-01-01' WHERE document_id = $1",
          [id],
        );
        await pgPool.query(
          "UPDATE import_attempts SET finished_at = '2025-01-01' WHERE document_id = $1",
          [id],
        );
      }
      await assert.rejects(
        withImportLock(
          () =>
            refreshDecisions(
              2,
              async (url) => {
                if (url.includes('TU991')) throw new Error('fixture outage');
                return fixture('HD01TU992').replace('acklamation', 'annat');
              },
              now,
            ),
          true,
        ),
        /Correction batch failed/,
      );
      const attempts = (
        await pgPool.query(
          "SELECT * FROM import_attempts WHERE job = 'refresh-decisions' AND NOT (id = ANY($1::uuid[]))",
          [before],
        )
      ).rows;
      assert.equal(attempts[0].status, 'failed');
      assert.equal(attempts[0].trigger, 'scheduled');
      assert.equal(attempts[0].expected_count, 2);
      assert.equal(attempts[0].imported_count, 1);
      await pgPool.query(
        "UPDATE decision_import_runs SET completed_at = $1 WHERE document_id IN ('HD01TU991','HD01TU992') AND completed_at > '2025-01-01'",
        [now],
      );
      await pgPool.query(
        "UPDATE import_attempts SET finished_at = $1 WHERE document_id IN ('HD01TU991','HD01TU992') AND finished_at > '2025-01-01'",
        [now],
      );
      const versions = await pgPool.query(
        "SELECT document_id, count(*)::int AS count FROM decision_import_runs WHERE document_id IN ('HD01TU991','HD01TU992') GROUP BY document_id ORDER BY document_id",
      );
      assert.deepEqual(
        versions.rows.map((row) => row.count),
        [1, 2],
      );
      const checked = await withImportLock(
        () => refreshDecisions(2, async () => fixture('HD01TU991'), now),
        true,
      );
      assert.deepEqual(checked, { checked: 1, published: 0 });
      const child = (
        await pgPool.query(
          "SELECT * FROM import_attempts WHERE job = 'decision' AND document_id = 'HD01TU991' ORDER BY started_at DESC, id DESC LIMIT 1",
        )
      ).rows[0];
      assert.equal(child.trigger, 'scheduled');
      assert.equal(child.unchanged, true);
      assert.equal(child.imported_count, 0);
      await pgPool.query(
        "UPDATE import_attempts SET finished_at = $1 WHERE document_id IN ('HD01TU991','HD01TU992') AND finished_at > '2025-01-01'",
        [now],
      );
      const fresh = await withImportLock(
        () =>
          refreshDecisions(
            2,
            async () => {
              throw new Error('fresh reports must not be fetched');
            },
            now,
          ),
        true,
      );
      assert.deepEqual(fresh, { checked: 0, published: 0 });
    } finally {
      if (catalogId)
        await pgPool.query('DELETE FROM report_catalog_runs WHERE id = $1', [
          catalogId,
        ]);
      await pgPool.query(
        "DELETE FROM decision_import_runs WHERE document_id IN ('HD01TU991','HD01TU992')",
      );
      await pgPool.query(
        'DELETE FROM import_attempts WHERE NOT (id = ANY($1::uuid[]))',
        [before],
      );
      await pgPool.end();
    }
  },
);

test(
  'scheduled missing-report batches continue past a failed document and report partial publication',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { importPendingReports } = await import(
      './sync-vote-linked-decisions'
    );
    const { recordImportAttempt } = await import('./lib/import-attempt');
    const { pgPool } = createDatabaseClient();
    const before = (
      await pgPool.query('SELECT id FROM import_attempts')
    ).rows.map((row) => row.id);
    try {
      await assert.rejects(
        withImportLock(
          () =>
            recordImportAttempt(
              {
                dataset: 'decisions',
                job: 'catalog-decisions',
                session: '2025/26',
              },
              async (progress) => {
                await progress.expected(2);
                return importPendingReports(
                  ['HD01TU993', 'HD01TU994'],
                  async (url) => {
                    if (url.includes('TU993'))
                      throw new Error('fixture outage');
                    return decisionFixture
                      .replace(/HD01TU8/g, 'HD01TU994')
                      .replace(/TU8/g, 'TU994');
                  },
                  progress.published,
                  true,
                );
              },
              (result) => ({ importedCount: result.length }),
            ),
          true,
        ),
        /after 1 completed reports/,
      );
      const parent = (
        await pgPool.query(
          "SELECT * FROM import_attempts WHERE job = 'catalog-decisions' AND NOT (id = ANY($1::uuid[]))",
          [before],
        )
      ).rows[0];
      assert.equal(parent.status, 'failed');
      assert.equal(parent.expected_count, 2);
      assert.equal(parent.imported_count, 1);
      assert.equal(parent.trigger, 'scheduled');
      const count = await pgPool.query(
        "SELECT count(*)::int AS count FROM decision_import_runs WHERE document_id = 'HD01TU994' AND completed_at IS NOT NULL",
      );
      assert.equal(count.rows[0].count, 1);
    } finally {
      await pgPool.query(
        "DELETE FROM decision_import_runs WHERE document_id IN ('HD01TU993','HD01TU994')",
      );
      await pgPool.query(
        'DELETE FROM import_attempts WHERE NOT (id = ANY($1::uuid[]))',
        [before],
      );
      await pgPool.end();
    }
  },
);

test(
  'a restarted scheduler reads persisted due times instead of repeating fresh jobs',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { scheduledPass } = await import('./scheduler');
    const { pgPool } = createDatabaseClient();
    const ids: string[] = [];
    const calls: string[] = [];
    try {
      for (const { job } of scheduledJobs) {
        const result = await pgPool.query(
          `INSERT INTO import_attempts (dataset,job,session,status,started_at,finished_at)
        VALUES ('decisions',$1,$2,'succeeded',$3,$3) RETURNING id`,
          [
            job,
            job === 'persons' ? null : '2025/26',
            new Date(Date.now() + 86400000),
          ],
        );
        ids.push(result.rows[0].id);
      }
      const run = async (job: (typeof scheduledJobs)[number]['job']) => {
        calls.push(job);
      };
      assert.deepEqual(await scheduledPass(1, run), []);
      await pgPool.query(
        "UPDATE import_attempts SET status = 'failed', finished_at = $2 WHERE id = $1",
        [ids[1], new Date(Date.now() - 7200000)],
      );
      assert.deepEqual(await scheduledPass(1, run), [
        { job: 'votes', status: 'succeeded' },
      ]);
      assert.deepEqual(calls, ['votes']);
      await assert.rejects(scheduledPass(26, run), /IMPORT_BATCH_LIMIT/);
    } finally {
      await pgPool.query(
        'DELETE FROM import_attempts WHERE id = ANY($1::uuid[])',
        [ids],
      );
      await pgPool.end();
    }
  },
);
