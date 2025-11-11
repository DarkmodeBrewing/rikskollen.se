import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { getDb } from "@rikskollen.se/db";

const buildServer = (): FastifyInstance => {
  const fastify = Fastify({ logger: true });

  // Basic healthcheck
  fastify.get("/health", async () => ({ status: "ok" }));

  // Example: proxy/augment external API
  fastify.get("/api/items", async (request, reply) => {
    const db = getDb();

    // 1) call external API
    const externalResponse = await fetch("https://some-api.example.com/items");
    if (!externalResponse.ok) {
      reply.code(502);
      return { error: "Upstream error" };
    }

    const externalItems = (await externalResponse.json()) as any[];

    // 2) maybe combine with local SQLite data
    const localRows = db
      .prepare("SELECT id, something FROM items WHERE something IS NOT NULL")
      .all();

    // 3) merge data
    const combined = externalItems.map((item) => ({
      ...item,
      localMeta: localRows.find((r) => r.id === item.id) ?? null,
    }));

    return combined;
  });

  return fastify;
};

if (require.main === module) {
  const server = buildServer();
  server
    .listen({ port: Number(process.env.PORT) || 4000, host: "0.0.0.0" })
    .then((address) => {
      server.log.info(`Server listening at ${address}`);
    });
}

export { buildServer };
