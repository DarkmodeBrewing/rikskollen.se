import { createDatabaseClient } from '@rikskollen/db';
import { documentIdSchema, downloadDecisionStatus } from './clients/decision-status';
import { syncDecision } from './sync-decisions';

export function selectPendingReports(
  sourceDocumentIds: string[],
  completedDocumentIds: string[],
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new Error('Batch limit must be between 1 and 25');
  const unsupported = sourceDocumentIds.filter((id) => !documentIdSchema.safeParse(id).success);
  if (unsupported.length)
    throw new Error(`Unsupported vote-linked document IDs: ${unsupported.join(', ')}`);
  const unique = new Map(sourceDocumentIds.map((id) => [id.toUpperCase(), id]));
  const completed = new Set(completedDocumentIds.map((id) => id.toUpperCase()));
  const candidates = [...unique].sort(([a], [b]) => a.localeCompare(b, 'sv'))
    .filter(([id]) => !completed.has(id)).map(([, id]) => id);
  return { candidates: candidates.slice(0, limit), pendingBefore: candidates.length, sourceDocumentCount: unique.size };
}

// The completed M2 vote snapshot bounds this batch. It cannot find reports
// whose decisions were all made without a recorded vote.
export async function syncVoteLinkedDecisions(
  limit = 10,
  load = downloadDecisionStatus,
) {
  const { pgPool } = createDatabaseClient();
  let voteRunId: string;
  let sourceIds: string[];
  let completedIds: string[];
  try {
    const run = await pgPool.query<{ id: string }>(`SELECT id FROM vote_import_runs
      WHERE session = '2025/26' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC LIMIT 1`);
    if (!run.rows[0]) throw new Error('Import a completed 2025/26 vote snapshot first');
    voteRunId = run.rows[0].id;
    const source = await pgPool.query<{ document_id: string }>(`SELECT DISTINCT document_id FROM vote_events
      WHERE run_id = $1 AND document_id IS NOT NULL`, [voteRunId]);
    sourceIds = source.rows.map((row) => row.document_id);
    const completed = await pgPool.query<{ document_id: string }>(`SELECT DISTINCT document_id FROM decision_import_runs
      WHERE completed_at IS NOT NULL`);
    completedIds = completed.rows.map((row) => row.document_id);
  } finally {
    await pgPool.end();
  }
  const selection = selectPendingReports(sourceIds, completedIds, limit);
  const imported: Array<{ documentId: string; pointCount: number }> = [];
  for (const documentId of selection.candidates) {
    try {
      const result = await syncDecision(documentId, load);
      imported.push({ documentId: result.documentId, pointCount: result.pointCount });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Stopped at ${documentId} after ${imported.length} completed reports; rerun to resume: ${detail}`);
    }
  }
  return {
    voteRunId,
    sourceDocumentCount: selection.sourceDocumentCount,
    pendingBefore: selection.pendingBefore,
    imported,
    pendingAfter: selection.pendingBefore - imported.length,
  };
}

if (process.argv[1]?.endsWith('sync-vote-linked-decisions.js') || process.argv[1]?.endsWith('sync-vote-linked-decisions.ts')) {
  const limit = process.argv[2] === undefined ? 10 : Number(process.argv[2]);
  syncVoteLinkedDecisions(limit).then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
