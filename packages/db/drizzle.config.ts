import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/db/src/schema/**/*.ts',
  out: './packages/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL ?? 'postgres://rikskollen:rikskollen@localhost:5432/rikskollen'
  }
} satisfies Config;
