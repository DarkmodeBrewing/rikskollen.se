import 'dotenv/config';
import { z } from 'zod';
import { pick } from './utils';

const ApiEnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  })
  .strict();

export const apiEnv = () =>
  ApiEnvSchema.parse(pick(process.env, ['NODE_ENV', 'PORT'] as const));

const WorkerEnvSchema = z.object({
  RIKSDAG_API_URL: z.url(),
});

export const workerEnv = () =>
  WorkerEnvSchema.parse(pick(process.env, ['RIKSDAG_API_URL'] as const));
