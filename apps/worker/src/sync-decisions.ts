import {
  recordImportAttempt,
  type AttemptProgress,
} from './lib/import-attempt';
import { eq } from 'drizzle-orm';
import {
  createDatabaseClient,
  decisionDocuments,
  decisionImportRuns,
  decisionPoints,
  decisionSourceChecks,
} from '@rikskollen/db';
import {
  decisionStatusUrl,
  documentIdSchema,
  downloadDecisionStatus,
  parseDecisionStatus,
  StructuredPointsUnavailable,
} from './clients/decision-status';

export async function syncDecision(
  documentId: string,
  load = downloadDecisionStatus,
  onlyChanged = false,
) {
  return recordImportAttempt(
    {
      dataset: 'decisions',
      job: 'decision',
      session: '2025/26',
      documentId: documentIdSchema.safeParse(documentId).success
        ? documentId.toUpperCase()
        : undefined,
    },
    (progress) => executeSyncDecision(documentId, load, progress, onlyChanged),
    (result) => ({
      importedCount:
        result.availability === 'unavailable' || result.unchanged ? 0 : 1,
      unavailableCount: result.availability === 'unavailable' ? 1 : 0,
      snapshotId: result.runId ?? undefined,
      unchanged: result.unchanged,
    }),
  );
}

async function executeSyncDecision(
  documentId: string,
  load = downloadDecisionStatus,
  progress: AttemptProgress,
  onlyChanged: boolean,
) {
  const id = documentIdSchema.parse(documentId);
  await progress.expected(1);
  const sourceUrl = decisionStatusUrl(id);
  const raw = await load(sourceUrl);
  let parsed: ReturnType<typeof parseDecisionStatus>;
  try {
    parsed = parseDecisionStatus(raw, id);
  } catch (error) {
    if (!(error instanceof StructuredPointsUnavailable)) throw error;
    const { db, pgPool } = createDatabaseClient();
    try {
      await db.insert(decisionSourceChecks).values({
        documentId: id.toUpperCase(),
        session: error.session,
        availability: 'unavailable',
        reason: 'structured-points-missing',
        sourceUrl,
        sourceHash: error.sourceHash,
      });
      return {
        availability: 'unavailable' as const,
        runId: null,
        documentId: id,
        pointCount: null,
        sourceHash: error.sourceHash,
        unchanged: false,
      };
    } finally {
      await pgPool.end();
    }
  }
  const { db, pgPool } = createDatabaseClient();
  try {
    if (onlyChanged) {
      const previous = await pgPool.query<{
        id: string;
        source_hash: string;
        expected_points: number;
        actual: number;
        documents: number;
      }>(
        `
        SELECT r.*, (SELECT count(*)::int FROM decision_points WHERE run_id = r.id) AS actual,
          (SELECT count(*)::int FROM decision_documents WHERE run_id = r.id AND session = '2025/26') AS documents
        FROM decision_import_runs r WHERE document_id = $1 AND completed_at IS NOT NULL
        ORDER BY completed_at DESC, id DESC LIMIT 1`,
        [id],
      );
      const run = previous.rows[0];
      if (
        run &&
        run.documents === 1 &&
        run.source_hash === parsed.sourceHash &&
        run.actual === parsed.points.length &&
        run.expected_points === run.actual
      ) {
        await db
          .insert(decisionSourceChecks)
          .values({
            documentId: id.toUpperCase(),
            session: parsed.document.session,
            availability: 'available',
            sourceUrl,
            sourceHash: parsed.sourceHash,
          });
        return {
          availability: 'available' as const,
          runId: run.id,
          documentId: id,
          pointCount: parsed.points.length,
          sourceHash: parsed.sourceHash,
          unchanged: true,
        };
      }
    }
    // One transaction publishes the complete report. Previous versions remain auditable.
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(decisionImportRuns)
        .values({
          documentId: id,
          sourceUrl,
          sourceHash: parsed.sourceHash,
          expectedPoints: parsed.points.length,
        })
        .returning();
      await tx
        .insert(decisionDocuments)
        .values({ ...parsed.document, runId: run.id });
      await tx
        .insert(decisionPoints)
        .values(parsed.points.map((point) => ({ ...point, runId: run.id })));
      await tx
        .update(decisionImportRuns)
        .set({ completedAt: new Date() })
        .where(eq(decisionImportRuns.id, run.id));
      await tx
        .insert(decisionSourceChecks)
        .values({
          documentId: id.toUpperCase(),
          session: parsed.document.session,
          availability: 'available',
          sourceUrl,
          sourceHash: parsed.sourceHash,
        });
      return {
        availability: 'available' as const,
        runId: run.id,
        documentId: id,
        pointCount: parsed.points.length,
        sourceHash: parsed.sourceHash,
        unchanged: false,
      };
    });
  } finally {
    await pgPool.end();
  }
}

if (
  process.argv[1]?.endsWith('sync-decisions.js') ||
  process.argv[1]?.endsWith('sync-decisions.ts')
) {
  const id = process.argv[2];
  if (!id) {
    console.error(
      'Usage: pnpm --filter @rikskollen/worker sync:decision HD01TU8',
    );
    process.exitCode = 1;
  } else {
    syncDecision(id)
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  }
}
