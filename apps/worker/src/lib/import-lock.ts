import { AsyncLocalStorage } from 'node:async_hooks';
import { createDatabaseClient } from '@rikskollen/db';

// One session lock covers both manual commands and an entire scheduled pass.
// Nested decision batches inherit ownership; they never acquire another lock.
const ownership = new AsyncLocalStorage<{ scheduled: boolean }>();
export const IMPORT_LOCK_KEY = 724031;
export const isScheduledImport = () => ownership.getStore()?.scheduled ?? false;
export class ImportBusyError extends Error {
  constructor() {
    super('Another import owns the database import lock');
  }
}
export async function withImportLock<T>(
  work: () => Promise<T>,
  scheduled = false,
): Promise<T> {
  if (ownership.getStore()) return work();
  const { pgPool } = createDatabaseClient();
  const client = await pgPool.connect().catch(async (error) => {
    await pgPool.end();
    throw error;
  });
  // Continuing to publish after losing the lock could overlap a new worker.
  const lost = () => {
    console.error('Import lock connection lost; terminating worker');
    process.exit(1);
  };
  client.on('error', lost);
  let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [IMPORT_LOCK_KEY],
    );
    acquired = result.rows[0].acquired;
    if (!acquired) throw new ImportBusyError();
    return await ownership.run({ scheduled }, work);
  } finally {
    try {
      if (acquired)
        await client.query('SELECT pg_advisory_unlock($1)', [IMPORT_LOCK_KEY]);
    } finally {
      client.removeListener('error', lost);
      client.release();
      await pgPool.end();
    }
  }
}
