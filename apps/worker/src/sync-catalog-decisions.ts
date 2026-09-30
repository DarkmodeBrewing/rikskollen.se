import { createDatabaseClient } from '@rikskollen/db';
import { downloadDecisionStatus } from './clients/decision-status';
import { importPendingReports, selectPendingReports } from './sync-vote-linked-decisions';

export async function syncCatalogDecisions(limit = 10, load = downloadDecisionStatus) {
  const { pgPool } = createDatabaseClient();
  let catalogRunId: string;
  let sourceIds: string[];
  let completedIds: string[];
  try {
    const run = await pgPool.query<{ id: string }>(`SELECT id FROM report_catalog_runs
      WHERE session = '2025/26' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC LIMIT 1`);
    if (!run.rows[0]) throw new Error('Import a completed 2025/26 report catalog first');
    catalogRunId = run.rows[0].id;
    const source = await pgPool.query<{ document_id: string }>(
      'SELECT document_id FROM report_catalog_entries WHERE run_id = $1', [catalogRunId]);
    sourceIds = source.rows.map((row) => row.document_id);
    const completed = await pgPool.query<{ document_id: string }>(
      'SELECT DISTINCT document_id FROM decision_import_runs WHERE completed_at IS NOT NULL');
    completedIds = completed.rows.map((row) => row.document_id);
  } finally {
    await pgPool.end();
  }
  const selection = selectPendingReports(sourceIds, completedIds, limit);
  const imported = await importPendingReports(selection.candidates, load);
  return {
    catalogRunId,
    sourceDocumentCount: selection.sourceDocumentCount,
    pendingBefore: selection.pendingBefore,
    imported,
    pendingAfter: selection.pendingBefore - imported.length,
  };
}

if (process.argv[1]?.endsWith('sync-catalog-decisions.js') || process.argv[1]?.endsWith('sync-catalog-decisions.ts')) {
  const limit = process.argv[2] === undefined ? 10 : Number(process.argv[2]);
  syncCatalogDecisions(limit).then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
