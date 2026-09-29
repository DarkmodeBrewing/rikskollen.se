import 'dotenv/config';
import { z } from 'zod';
import { pick } from './utils';

const DBEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  })
  .strict();

export const DbEnv = () => DBEnvSchema.parse(
  pick(process.env, ['DATABASE_URL'] as const),
);
