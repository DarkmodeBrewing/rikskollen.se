import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  validatorCompiler,
  serializerCompiler,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiEnv } from '@rikskollen/shared-types';
import { getAllPoliticians } from './db';

const env = apiEnv();

const app = Fastify({
  logger:
    env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
}).withTypeProvider<ZodTypeProvider>();

// ✨ Tell Fastify how to deal with Zod:
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Routes
app.get(
  '/',
  { schema: { response: { 200: z.object({ hello: z.string() }) } } },
  async () => {
    return { hello: 'world' };
  },
);

const HealthResponseSchema = {
  schema: {
    response: {
      200: z.object({ ok: z.literal(true), uptime: z.number() }),
    },
  },
};

app.get('/health', HealthResponseSchema, async () => ({
  ok: true as const,
  uptime: process.uptime(),
}));

app.get('/api/persons', async () => {
  return getAllPoliticians();
});

// Server init
export const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
