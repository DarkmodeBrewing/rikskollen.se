import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  validatorCompiler,
  serializerCompiler,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env, getPoliticans } from '@rikskollen/shared-types';

const app = Fastify({
  logger:
    env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
}).withTypeProvider<ZodTypeProvider>();

// ✨ Tell Fastify how to deal with Zod:
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.get(
  '/',
  { schema: { response: { 200: z.object({ hello: z.string() }) } } },
  async () => {
    return { hello: 'world' };
  },
);

const healthResponseSchema = {
  schema: {
    response: {
      200: z.object({ ok: z.literal(true), uptime: z.number() }),
    },
  },
};

app.get('/health', healthResponseSchema, async () => ({
  ok: true as const,
  uptime: process.uptime(),
}));

app.get('/api/politicians', async () => {
  const p = await getPoliticans();
  console.log(p);
  return p;
});

export const start = async () => {
  try {
    await app.listen({ port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
