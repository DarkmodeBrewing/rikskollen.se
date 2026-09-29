import type { Config } from 'drizzle-kit';

export default {
  // Only tables ready for persisted data belong in an applied migration.
  schema: './src/schema/migrate.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://rikskollen:rikskollen@localhost:5432/rikskollen',
  },
} satisfies Config;
