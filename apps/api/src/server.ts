import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  validatorCompiler,
  serializerCompiler,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiEnv } from '@rikskollen/shared-types';
import { getPerson, getImportStatus, listPersons } from './db';

const env = apiEnv();

export const app = Fastify({
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

const ListQuery = z.object({
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
app.get('/api/persons', async (request, reply) => {
  const parsed = ListQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
  return listPersons(parsed.data.q, parsed.data.page, parsed.data.limit);
});
app.get('/api/persons/:id', async (request, reply) => {
  const parsed = z
    .object({ id: z.string().regex(/^\d{1,30}$/) })
    .safeParse(request.params);
  if (!parsed.success)
    return reply.code(400).send({ error: 'Invalid person ID' });
  const person = await getPerson(parsed.data.id);
  return person ?? reply.code(404).send({ error: 'Person not found' });
});
app.get('/api/import-status', getImportStatus);

// Server init
export const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
