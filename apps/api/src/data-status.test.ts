import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { readDataStatus } from './data-status';

test(
  'status uses completed latest versions, known catalog denominator, and bounded attempt history',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    const catalogIds: string[] = [],
      reportIds: string[] = [],
      attemptIds: string[] = [];
    try {
      const empty = await readDataStatus(pgPool, 1);
      assert.deepEqual(empty.coverage, []);
      if (empty.history.total === 0)
        assert.equal(empty.trackingStartedAt, null);
      const catalog =
        await pgPool.query(`INSERT INTO report_catalog_runs (session,source_url,source_hash,expected_count,page_count,completed_at)
        VALUES ('2025/26','https://data.riksdagen.se/dokumentlista/','hash',2,1,'2030-01-01T00:00:00Z') RETURNING id`);
      const id = catalog.rows[0].id;
      catalogIds.push(id);
      await pgPool.query(
        `INSERT INTO report_catalog_pages (run_id,page,source_url,source_hash,item_count) VALUES ($1,1,'page','hash',2)`,
        [id],
      );
      await pgPool.query(
        `INSERT INTO report_catalog_entries (run_id,document_id,designation,title,page) VALUES
        ($1,'HD01TU8','TU8','Source example',1),($1,'HD01TU9','TU9','Synthetic missing',1)`,
        [id],
      );
      const zero = await readDataStatus(pgPool, 1);
      const zeroReports = zero.coverage.find((r) => r.dataset === 'decisions')!;
      assert.equal(zeroReports.importedCount, 0);
      assert.equal(zeroReports.expectedCount, 2);
      assert.equal(zeroReports.lastSuccessfulAt, null);
      for (const [completed, points, session] of [
        ['2026-01-01T00:00:00Z', 2, '2025/26'],
        ['2026-01-02T00:00:00Z', 1, '2025/26'],
        [null, 3, '2025/26'],
        ['2026-01-03T00:00:00Z', 5, '2024/25'],
      ] as const) {
        const run = await pgPool.query(
          `INSERT INTO decision_import_runs (document_id,source_url,source_hash,expected_points,completed_at)
          VALUES ($1,'https://data.riksdagen.se/dokumentstatus/HD01TU8.json','hash',$2,$3) RETURNING id`,
          [session === '2024/25' ? 'HD01TU9' : 'HD01TU8', points, completed],
        );
        const rid = run.rows[0].id;
        reportIds.push(rid);
        await pgPool.query(
          `INSERT INTO decision_documents (run_id,document_id,session,designation,title,status)
          VALUES ($1,$2,$3,'TU8','Source example','done')`,
          [rid, session === '2024/25' ? 'HD01TU9' : 'HD01TU8', session],
        );
        for (let i = 0; i < points; i++)
          await pgPool.query(
            `INSERT INTO decision_points (run_id,point,heading,proposal_text,decision_type)
          VALUES ($1,$2,'Source heading','Proposal','acklamation')`,
            [rid, String(i + 1)],
          );
      }
      for (let i = 0; i < 21; i++) {
        const row = await pgPool.query(
          `INSERT INTO import_attempts (dataset,job,session,status,started_at,finished_at,imported_count)
          VALUES ('catalog','report-catalog','2025/26',$1,$2,$3,0) RETURNING id`,
          [
            i === 20 ? 'running' : 'failed',
            new Date(Date.UTC(2030, 0, 1, 0, i)),
            i === 20 ? null : new Date(Date.UTC(2030, 0, 1, 0, i, 5)),
          ],
        );
        attemptIds.push(row.rows[0].id);
      }
      const status = await readDataStatus(pgPool, 1);
      const reports = status.coverage.find((r) => r.dataset === 'decisions')!;
      assert.equal(reports.importedCount, 1);
      assert.equal(reports.expectedCount, 2);
      assert.equal(reports.secondaryCount, 1); // Corrected version; pending and older versions excluded.
      assert.equal(reports.lastSuccessfulAt, '2026-01-02T00:00:00.000Z');
      assert.equal(
        status.coverage.find((r) => r.dataset === 'catalog')!.lastSuccessfulAt,
        '2030-01-01T00:00:00.000Z',
      );
      assert.equal(status.history.items.length, 20);
      assert.equal(status.history.total, empty.history.total + 21);
      assert.equal(
        status.latestAttempts.find((r) => r.job === 'report-catalog')!.status,
        'running',
      );
      assert.equal(
        status.latestAttempts.find((r) => r.job === 'report-catalog')!
          .durationSeconds,
        null,
      );
      assert.equal(
        (await readDataStatus(pgPool, 2)).history.items.filter((r) =>
          attemptIds.includes(r.id),
        ).length,
        1,
      );
      assert.doesNotMatch(
        JSON.stringify(status),
        /source_hash|stack|errorMessage/,
      );
      const { app } = await import('./server');
      const { closeDatabase } = await import('./db');
      try {
        assert.equal((await app.inject('/api/data-status')).statusCode, 200);
        assert.equal(
          (await app.inject('/api/data-status?page=0')).statusCode,
          400,
        );
        assert.equal(
          (await app.inject('/api/data-status?page=1.5')).statusCode,
          400,
        );
      } finally {
        await app.close();
        await closeDatabase();
      }
    } finally {
      await pgPool.query(
        'DELETE FROM import_attempts WHERE id = ANY($1::uuid[])',
        [attemptIds],
      );
      await pgPool.query(
        'DELETE FROM decision_import_runs WHERE id = ANY($1::uuid[])',
        [reportIds],
      );
      await pgPool.query(
        'DELETE FROM report_catalog_runs WHERE id = ANY($1::uuid[])',
        [catalogIds],
      );
      await pgPool.end();
    }
  },
);
