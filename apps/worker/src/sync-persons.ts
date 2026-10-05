import {
  recordImportAttempt,
  type AttemptProgress,
} from './lib/import-attempt';
import { createDatabaseClient, importRuns, persons } from '@rikskollen/db';
import { getPersons } from './clients/person';

export async function syncPersons(load = getPersons) {
  return recordImportAttempt(
    { dataset: 'members', job: 'persons' },
    (progress) => executeSyncPersons(load, progress),
    (result) => ({ importedCount: result.count, snapshotId: result.runId }),
  );
}

async function executeSyncPersons(
  load = getPersons,
  progress: AttemptProgress,
) {
  const batch = await load();
  await progress.expected(batch.expectedCount); // All network work and validation precedes the transaction.
  const { db, pgPool } = createDatabaseClient();
  const now = new Date();
  try {
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(importRuns)
        .values({
          sourceUrl: batch.sourceUrl,
          sourceDate: batch.sourceDate,
          expectedCount: batch.expectedCount,
          importedCount: batch.items.length,
          batchCount: batch.batchCount,
          completedAt: now,
        })
        .returning();
      for (const { person, sourceUrl, sourceHash } of batch.items) {
        const values = {
          personId: person.personId,
          sourceId: person.sourceId,
          givenName: person.givenName,
          lastName: person.lastName,
          gender: person.gender,
          birthYear: person.birthYear,
          status: person.status,
          personUrl: person.politicianUrl,
          imageMax: person.imageMax,
          partyCode: person.partyCode,
          constituency: person.constituency,
          assignments: person.assignments,
          sourceUrl,
          sourceHash,
          fetchedAt: now,
          updatedAt: now,
          importRunId: run.id,
        };
        await tx.insert(persons).values(values).onConflictDoUpdate({
          target: persons.personId,
          set: values,
        });
      }
      return {
        runId: run.id,
        count: batch.items.length,
        batches: batch.batchCount,
      };
    });
  } finally {
    await pgPool.end();
  }
}

if (
  process.argv[1]?.endsWith('sync-persons.js') ||
  process.argv[1]?.endsWith('sync-persons.ts')
) {
  syncPersons()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
