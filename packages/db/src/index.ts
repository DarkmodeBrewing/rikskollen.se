import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DbEnv } from '@rikskollen/shared-types';

export interface DatabaseConfig {
  connectionString: string;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const connectionString = DbEnv().DATABASE_URL;

  if (!connectionString) {
    throw new Error('DB_URL environment variable is required');
  }

  return { connectionString };
};

// Export type-safe db client for consumers
export const createDatabaseClient = () => {
  const { connectionString } = getDatabaseConfig();

  const pgPool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  const db = drizzle(pgPool);

  return { db, pgPool };
};

export * from './schema';
export * from './mapping';
