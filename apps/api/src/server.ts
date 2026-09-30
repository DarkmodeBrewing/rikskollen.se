import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  validatorCompiler,
  serializerCompiler,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiEnv } from '@rikskollen/shared-types';
import {
  getPerson,
  getImportStatus,
  listPersons,
  getVote,
  getVoteImportStatus,
  listVotes,
  getMemberVotes,
  getDecisionTrail,
  listDecisions,
  checkDatabaseReady,
} from './db';

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
app.get('/ready', async (_request, reply) => {
  try {
    await checkDatabaseReady();
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

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

const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
app.get('/api/votes', async (request, reply) => {
  const query = PageQuery.safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'Invalid query' });
  return listVotes(query.data.page, query.data.limit);
});
app.get('/api/votes/import-status', getVoteImportStatus);
app.get('/api/votes/:voteId', async (request, reply) => {
  const params = z.object({ voteId: z.uuid() }).safeParse(request.params);
  if (!params.success)
    return reply.code(400).send({ error: 'Invalid vote ID' });
  return (
    (await getVote(params.data.voteId.toLowerCase())) ??
    reply.code(404).send({ error: 'Vote not found' })
  );
});
app.get('/api/persons/:id/votes', async (request, reply) => {
  const params = z
    .object({ id: z.string().regex(/^\d{1,30}$/) })
    .safeParse(request.params);
  const query = PageQuery.extend({ choice: z.string().max(100).optional() }).safeParse(request.query);
  if (!params.success || !query.success)
    return reply.code(400).send({ error: 'Invalid request' });
  return getMemberVotes(params.data.id, query.data.page, query.data.limit, query.data.choice);
});
app.get('/api/decisions', async (request, reply) => {
  const query = PageQuery.safeParse(request.query);
  if (!query.success) return reply.code(400).send({ error: 'Invalid query' });
  return listDecisions(query.data.page, query.data.limit);
});
app.get('/api/decisions/:documentId', async (request, reply) => {
  const params = z.object({ documentId: z.string().regex(/^HD01[A-Za-zÅÄÖåäö]{1,4}\d{1,3}$/i) }).safeParse(request.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid document ID' });
  return (await getDecisionTrail(params.data.documentId)) ?? reply.code(404).send({ error: 'Decision trail not imported' });
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
