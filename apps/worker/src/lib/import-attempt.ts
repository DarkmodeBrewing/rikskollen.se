import { withImportLock, isScheduledImport } from './import-lock';
import type { ImportJob } from '@rikskollen/shared-types';
import { createDatabaseClient, importAttempts } from '@rikskollen/db';
import { eq } from 'drizzle-orm';

export interface AttemptProgress {
  expected(count: number): Promise<void>;
  published(count: number): Promise<void>;
}
interface AttemptScope {
  dataset: 'members' | 'votes' | 'catalog' | 'decisions';
  job: ImportJob;
  session?: string;
  documentId?: string;
}

export async function recordImportAttempt<T>(
  scope: AttemptScope,
  work: (progress: AttemptProgress) => Promise<T>,
  summary: (result: T) => {
    importedCount: number;
    snapshotId?: string;
    unchanged?: boolean;
  },
): Promise<T> {
  const { db, pgPool } = createDatabaseClient();
  let id: string | undefined;
  let workCompleted = false;
  try {
    const [attempt] = await db
      .insert(importAttempts)
      .values({
        ...scope,
        trigger: isScheduledImport() ? 'scheduled' : 'manual',
      })
      .returning();
    id = attempt.id;
    const progress: AttemptProgress = {
      expected: async (expectedCount) => {
        await db
          .update(importAttempts)
          .set({ expectedCount })
          .where(eq(importAttempts.id, attempt.id));
      },
      published: async (importedCount) => {
        await db
          .update(importAttempts)
          .set({ importedCount })
          .where(eq(importAttempts.id, attempt.id));
      },
    };
    const result = await withImportLock(() => work(progress));
    workCompleted = true;
    await db
      .update(importAttempts)
      .set({ ...summary(result), status: 'succeeded', finishedAt: new Date() })
      .where(eq(importAttempts.id, attempt.id));
    return result;
  } catch (error) {
    if (id && !workCompleted) {
      try {
        await db
          .update(importAttempts)
          .set({ status: 'failed', finishedAt: new Date() })
          .where(eq(importAttempts.id, id));
      } catch (trackingError) {
        // Preserve the original error. An unfinished attempt is shown as unknown
        // on the public page; database failures cannot reliably be logged to it.
        console.error('Could not finish import attempt', trackingError);
      }
    }
    throw error;
  } finally {
    await pgPool.end();
  }
}
