import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { pick } from './utils';

// Ensure we load the file you think you're loading
const envPath = resolve(process.cwd(), '.env');

if (!existsSync(envPath)) {
  console.warn(`[env] .env not found at ${envPath}. CWD=${process.cwd()}`);
}

config({ path: envPath }); // idempotent and safe to call once at boot

const DBEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  })
  .strict();

export const DbEnv = () => DBEnvSchema.parse(
  pick(process.env, ['DATABASE_URL'] as const),
);
