import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabaseClient } from './index';

const { db, pgPool } = createDatabaseClient();
try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../migrations/', import.meta.url)),
  });
  console.log('Database migrations complete');
} finally {
  await pgPool.end();
}
