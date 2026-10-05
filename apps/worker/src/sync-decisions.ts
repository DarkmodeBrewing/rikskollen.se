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
} from '@rikskollen/db';
import {
  decisionStatusUrl,
  documentIdSchema,
  downloadDecisionStatus,
  parseDecisionStatus,
} from './clients/decision-status';

export async function syncDecision(
  documentId: string,
  load = downloadDecisionStatus,
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
    (progress) => executeSyncDecision(documentId, load, progress),
    (result) => ({ importedCount: 1, snapshotId: result.runId }),
  );
}

async function executeSyncDecision(
  documentId: string,
  load = downloadDecisionStatus,
  progress: AttemptProgress,
) {
  const id = documentIdSchema.parse(documentId);
  await progress.expected(1);
  const sourceUrl = decisionStatusUrl(id);
  const parsed = parseDecisionStatus(await load(sourceUrl), id);
  const { db, pgPool } = createDatabaseClient();
  try {
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
      return {
        runId: run.id,
        documentId: id,
        pointCount: parsed.points.length,
        sourceHash: parsed.sourceHash,
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
