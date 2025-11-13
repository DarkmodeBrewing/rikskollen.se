// src/env.ts
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';

// Ensure we load the file you think you're loading
const envPath = resolve(process.cwd(), '.env');

if (!existsSync(envPath)) {
  console.warn(`[env] .env not found at ${envPath}. CWD=${process.cwd()}`);
}

config({ path: envPath }); // idempotent and safe to call once at boot

// Strict, no coercion. Fail fast if missing.
const EnvSchema = z
  .object({
    RIKSDAG_API_URL: z.string().min(1, 'RIKSDAG_API_URL is required'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  })
  .strict();

const pick = <T extends object, K extends readonly (keyof any)[]>(
  obj: any,
  keys: K,
) => Object.fromEntries(keys.map((k) => [k, obj[k as any]]));

export const env = EnvSchema.parse(
  pick(process.env, ['RIKSDAG_API_URL', 'NODE_ENV', 'PORT'] as const),
);

// if (process.env.DEBUG_ENV === '1') {
//   console.log('[env] loaded', {
//     CWD: process.cwd(),
//     RIKSDAG_API_URL: env.RIKSDAG_API_URL,
//   });
// }
