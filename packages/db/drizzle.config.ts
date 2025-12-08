import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/**/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DB_URL ??
      'postgres://rikskollen:rikskollen@localhost:5432/rikskollen',
  },
} satisfies Config;
