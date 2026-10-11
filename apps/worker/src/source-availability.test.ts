import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { decisionFixture } from './clients/decision-fixture';
import { syncCatalogDecisions } from './sync-catalog-decisions';
import { syncDecision } from './sync-decisions';

test(
  'unavailable reports remain uncovered, defer for 24 hours, recover on a source change, and malformed replies still fail',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    let catalog: string | undefined;
    const before = (
      await pgPool.query('SELECT id FROM import_attempts')
    ).rows.map((r) => r.id);
    const fixture = (id: string, missing = false) => {
      const source = JSON.parse(decisionFixture.replace(/HD01TU8/g, id));
      if (missing) delete source.dokumentstatus.dokutskottsforslag;
      return JSON.stringify(source);
    };
    try {
      catalog = (
        await pgPool.query(`INSERT INTO report_catalog_runs (session,source_url,source_hash,expected_count,page_count,completed_at)
        VALUES ('2025/26','fixture','fixture',2,1,'2035-01-01') RETURNING id`)
      ).rows[0].id;
      await pgPool.query(
        `INSERT INTO report_catalog_pages (run_id,page,source_url,source_hash,item_count) VALUES ($1,1,'fixture','fixture',2)`,
        [catalog],
      );
      await pgPool.query(
        `INSERT INTO report_catalog_entries (run_id,document_id,designation,title,page) VALUES
        ($1,'HD01TU981','TU981','Synthetic unavailable report',1),($1,'HD01TU982','TU982','Synthetic available report',1)`,
        [catalog],
      );
      const batch = await syncCatalogDecisions(
        2,
        async (url) =>
          fixture(
            url.includes('TU981') ? 'HD01TU981' : 'HD01TU982',
            url.includes('TU981'),
          ),
        true,
      );
      assert.equal(batch.imported.length, 1);
      const parent = (
        await pgPool.query(
          "SELECT status,imported_count,unavailable_count FROM import_attempts WHERE job = 'catalog-decisions' ORDER BY started_at DESC,id DESC LIMIT 1",
        )
      ).rows[0];
      assert.deepEqual(parent, {
        status: 'succeeded',
        imported_count: 1,
        unavailable_count: 1,
      });
      assert.equal(
        (
          await pgPool.query(
            "SELECT count(*)::int AS count FROM decision_import_runs WHERE document_id = 'HD01TU981'",
          )
        ).rows[0].count,
        0,
      );
      const skipped = await syncCatalogDecisions(
        2,
        async () => {
          throw new Error('Must not refetch fresh unavailability');
        },
        true,
      );
      assert.equal(skipped.imported.length, 0);
      await pgPool.query(
        "UPDATE decision_source_checks SET checked_at = now() - interval '25 hours' WHERE document_id = 'HD01TU981'",
      );
      const recovered = await syncCatalogDecisions(
        2,
        async () => fixture('HD01TU981'),
        true,
      );
      assert.equal(recovered.imported.length, 1);
      const missingAgain = await syncDecision('HD01TU981', async () =>
        fixture('HD01TU981', true),
      );
      assert.equal(missingAgain.availability, 'unavailable');
      assert.equal(
        (
          await pgPool.query(
            "SELECT count(*)::int AS count FROM decision_import_runs WHERE document_id = 'HD01TU981' AND completed_at IS NOT NULL",
          )
        ).rows[0].count,
        1,
      );
      const observed = (
        await pgPool.query(
          "SELECT id FROM decision_source_checks WHERE document_id = 'HD01TU981'",
        )
      ).rows.length;
      const malformed = JSON.parse(fixture('HD01TU981'));
      malformed.dokumentstatus.dokutskottsforslag = {};
      await assert.rejects(
        syncDecision('HD01TU981', async () => JSON.stringify(malformed)),
      );
      await assert.rejects(
        syncDecision('HD01TU981', async () => {
          throw new Error('HTTP fixture outage');
        }),
        /fixture outage/,
      );
      assert.equal(
        (
          await pgPool.query(
            "SELECT id FROM decision_source_checks WHERE document_id = 'HD01TU981'",
          )
        ).rows.length,
        observed,
      );
      assert.equal(
        (
          await pgPool.query(
            "SELECT status FROM import_attempts WHERE document_id = 'HD01TU981' ORDER BY started_at DESC,id DESC LIMIT 1",
          )
        ).rows[0].status,
        'failed',
      );
    } finally {
      await pgPool.query(
        "DELETE FROM decision_source_checks WHERE document_id IN ('HD01TU981','HD01TU982')",
      );
      await pgPool.query(
        "DELETE FROM decision_import_runs WHERE document_id IN ('HD01TU981','HD01TU982')",
      );
      if (catalog)
        await pgPool.query('DELETE FROM report_catalog_runs WHERE id = $1', [
          catalog,
        ]);
      await pgPool.query(
        'DELETE FROM import_attempts WHERE NOT (id = ANY($1::uuid[]))',
        [before],
      );
      await pgPool.end();
    }
  },
);
