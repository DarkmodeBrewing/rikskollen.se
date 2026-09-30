import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { reportCatalogUrl } from './clients/report-catalog';
import { syncReportCatalog } from './sync-report-catalog';
import { syncCatalogDecisions } from './sync-catalog-decisions';
import { decisionFixture } from './clients/decision-fixture';

test('publishes only a complete catalog and keeps the previous version on failure',
  { skip: !process.env.DATABASE_URL }, async () => {
    const { pgPool } = createDatabaseClient();
    const ids: string[] = [];
    const decisionRunIds: string[] = [];
    const raw = JSON.stringify({ dokumentlista: {
      '@sida': '1', '@sidor': '1', '@traffar': '1', '@traff_fran': '1', '@traff_till': '1',
      dokument: { dok_id: 'HD01TU8', rm: '2025/26', doktyp: 'bet', beteckning: 'TU8',
        titel: 'Digitaliserings- och postfrågor', datum: '2026-02-05', beslutad: '1' },
    } });
    try {
      for (let i = 0; i < 2; i++) {
        const result = await syncReportCatalog(async (url) => {
          assert.equal(url, reportCatalogUrl(1));
          return raw;
        });
        ids.push(result.runId);
        assert.equal(result.documentCount, 1);
      }
      await assert.rejects(syncReportCatalog(async () => raw.replace('"@traff_till":"1"', '"@traff_till":"2"')), /Incomplete/);
      const rows = await pgPool.query(`SELECT r.id, count(e.document_id)::int AS entries, count(DISTINCT p.page)::int AS pages
        FROM report_catalog_runs r JOIN report_catalog_pages p ON p.run_id = r.id
        JOIN report_catalog_entries e ON e.run_id = r.id
        WHERE r.id = ANY($1::uuid[]) GROUP BY r.id`, [ids]);
      assert.equal(rows.rows.length, 2);
      assert.ok(rows.rows.every((row) => row.entries === 1 && row.pages === 1));
      const batch = await syncCatalogDecisions(1, async () => decisionFixture);
      decisionRunIds.push(...batch.imported.map((item) => item.runId));
      assert.equal(batch.sourceDocumentCount, 1);
      assert.equal(batch.imported.length, 1);
      assert.equal((await syncCatalogDecisions(1, async () => { throw new Error('Already imported'); })).pendingBefore, 0);
    } finally {
      if (decisionRunIds.length) await pgPool.query('DELETE FROM decision_import_runs WHERE id = ANY($1::uuid[])', [decisionRunIds]);
      if (ids.length) await pgPool.query('DELETE FROM report_catalog_runs WHERE id = ANY($1::uuid[])', [ids]);
      await pgPool.end();
    }
  });
