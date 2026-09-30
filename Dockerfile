# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @rikskollen/api --prod deploy /out/api \
    && pnpm --filter @rikskollen/worker --prod deploy /out/worker \
    && pnpm --filter @rikskollen/db --prod deploy /out/db

FROM node:22-bookworm-slim AS runtime
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV NODE_ENV=production
WORKDIR /app
USER node

FROM runtime AS api
COPY --from=build --chown=node:node /out/api/ ./
EXPOSE 3000
CMD ["node", "dist/index.js"]

FROM runtime AS web
COPY --from=build --chown=node:node /workspace/apps/webapp/dist/webapp/ ./
EXPOSE 4000
CMD ["node", "server/server.mjs"]

FROM runtime AS worker
COPY --from=build --chown=node:node /out/worker/ ./
ENTRYPOINT ["node"]
# Imports are explicit one-off jobs; starting the profile alone does no ingestion.
CMD ["--version"]

FROM runtime AS migrate
COPY --from=build --chown=node:node /out/db/ ./
CMD ["node", "dist/migrate.js"]
