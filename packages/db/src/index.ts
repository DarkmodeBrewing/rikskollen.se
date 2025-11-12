import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getDatabaseConfig } from './env.js';

// Export type-safe db client for consumers
export const createDatabaseClient = () => {
  const { connectionString } = getDatabaseConfig();

  // Use a shared pg.Pool so API + worker can reuse logic
  const pgPool = new pg.Pool({
    connectionString,
    // optional tuning
    max: 10, // max connections in pool
    idleTimeoutMillis: 30_000,
  });

  const db = drizzle(pgPool);

  return { db, pgPool };
};

export { politiciansScheme } from './schema/core';
