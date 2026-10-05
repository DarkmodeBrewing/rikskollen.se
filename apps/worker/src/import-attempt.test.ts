import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { syncPersons } from './sync-persons';
import { syncVotes } from './sync-votes';
import { syncDecision } from './sync-decisions';
import { syncReportCatalog } from './sync-report-catalog';
import { syncCatalogDecisions } from './sync-catalog-decisions';
import { decisionFixture } from './clients/decision-fixture';

process.env.RIKSDAG_API_URL = 'https://data.riksdagen.se';
test(
  'fetch failures are durable and a partial batch records only published reports',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    const before = (
      await pgPool.query('SELECT id FROM import_attempts')
    ).rows.map((r) => r.id);
    let catalogId: string | undefined;
    const reportId = 'HD01TU991';
    try {
      const fail = async (): Promise<never> => {
        throw new Error('secret token=never-publish');
      };
      for (const work of [
        () => syncPersons(fail),
        () => syncVotes(fail),
        () => syncDecision('HD01TU992', fail),
        () => syncReportCatalog(fail),
      ]) {
        await assert.rejects(work(), /never-publish/);
      }
      const failures = await pgPool.query(
        'SELECT * FROM import_attempts WHERE NOT (id = ANY($1::uuid[]))',
        [before],
      );
      assert.equal(failures.rows.length, 4);
      assert.ok(
        failures.rows.every(
          (r) =>
            r.status === 'failed' && r.finished_at && r.imported_count === 0,
        ),
      );
      assert.doesNotMatch(JSON.stringify(failures.rows), /secret|token/);
      const catalog =
        await pgPool.query(`INSERT INTO report_catalog_runs (session,source_url,source_hash,expected_count,page_count,completed_at)
        VALUES ('2025/26','fixture','fixture',2,1,now() + interval '1 minute') RETURNING id`);
      catalogId = catalog.rows[0].id;
      await pgPool.query(
        `INSERT INTO report_catalog_pages (run_id,page,source_url,source_hash,item_count) VALUES ($1,1,'fixture','fixture',2)`,
        [catalogId],
      );
      await pgPool.query(
        `INSERT INTO report_catalog_entries (run_id,document_id,designation,title,page) VALUES
        ($1,'HD01TU991','TU991','First',1), ($1,'HD01TU992','TU992','Second',1)`,
        [catalogId],
      );
      await assert.rejects(
        syncCatalogDecisions(2, async (url) => {
          if (url.includes('TU992')) throw new Error('second failed');
          return decisionFixture
            .replace(/HD01TU8/g, reportId)
            .replace(/TU8/g, 'TU991');
        }),
        /after 1 completed reports/,
      );
      const batch = await pgPool.query(
        `SELECT * FROM import_attempts WHERE job = 'catalog-decisions' AND NOT (id = ANY($1::uuid[]))`,
        [before],
      );
      assert.equal(batch.rows[0].status, 'failed');
      assert.equal(batch.rows[0].imported_count, 1);
      assert.equal(batch.rows[0].expected_count, 2);
      assert.equal(
        (
          await pgPool.query(
            `SELECT count(*)::int AS count FROM decision_import_runs WHERE document_id = $1 AND completed_at IS NOT NULL`,
            [reportId],
          )
        ).rows[0].count,
        1,
      );
      const resumed = await syncCatalogDecisions(2, async () =>
        decisionFixture
          .replace(/HD01TU8/g, 'HD01TU992')
          .replace(/TU8/g, 'TU992'),
      );
      assert.equal(resumed.pendingBefore, 1);
      assert.equal(resumed.pendingAfter, 0);
    } finally {
      await pgPool.query(
        `DELETE FROM decision_import_runs WHERE document_id IN ('HD01TU991','HD01TU992')`,
      );
      if (catalogId)
        await pgPool.query('DELETE FROM report_catalog_runs WHERE id = $1', [
          catalogId,
        ]);
      await pgPool.query(
        'DELETE FROM import_attempts WHERE NOT (id = ANY($1::uuid[]))',
        [before],
      );
      await pgPool.end();
    }
  },
);
