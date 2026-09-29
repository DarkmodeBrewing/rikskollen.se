# Rikskollen

Rikskollen is a proposed public, independent view of what happens in the Swedish Riksdag. It uses the Riksdag's open data to make members, assignments, recorded votes, decisions and their source documents easier to explore. The aim is to answer factual questions such as “How did this member vote on this proposal?” and “Which votes recorded this member as absent?” without assigning political scores or guessing motives.

**Status:** early prototype. The repository is not yet a working public service. See [project brief](docs/product.md), [data and methodology](docs/data-methodology.md), and [roadmap](docs/roadmap.md).

## Product principles

- Show the original Riksdag source and retrieval/update time alongside interpreted data.
- Preserve source identifiers, history and corrections. Explain every transformation and statistic.
- Distinguish a recorded vote, a proposal point, a document and the eventual decision.
- Describe “Frånvarande” as a status in a particular recorded vote; do not present vote records as general attendance at work.
- Make incomplete coverage and known source-data limitations visible.
- Publish factual records without party or member rankings and without inferred motives.

Rikskollen is **independent of Sveriges riksdag**. Source: Sveriges riksdag. Any member photographs require separate attribution (“Foto: Sveriges riksdag”) and a rights review.

## Repository today

| Path | Intended role | Current state |
| --- | --- | --- |
| `apps/worker` | Fetch and normalize open data | Experimental person and vote clients; entry point prints a limited vote sample |
| `packages/shared-types` | Source and internal schemas | Partially modelled; several contracts need reconciliation with actual API responses |
| `packages/db` | PostgreSQL/Drizzle models | Initial persons migration and mapping tests; ingestion is not implemented |
| `apps/api` | Public read API | Health route and database-backed person list (empty until import) |
| `apps/webapp` | Angular web UI | Starter application |
| `docker-compose.yml` | Local database | PostgreSQL only; API and webapp run on the host |

The vote, attendance and assignment schemas remain drafts outside the applied migration. The next data milestone is to import people with stable IDs and provenance before expanding the public view.

## Local development

Use Node 22, pnpm 9 and Docker Compose. From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
docker compose up -d db
export DATABASE_URL=postgres://rikskollen:rikskollen@localhost:5432/rikskollen
pnpm build
pnpm --filter @rikskollen/db migrate
pnpm test
pnpm dev:api
```

The API listens on port 3000 by default. `/health` reports process health; `/api/persons` reads the local database and returns `[]` before any import. Start Angular separately with `pnpm dev:web` (port 4200). The worker's `dry:vote-cases` command fetches and prints a small sample; it does **not** ingest data. To run it, set `RIKSDAG_API_URL=https://data.riksdagen.se` and use `pnpm --filter @rikskollen/worker dry:vote-cases`.

The database password above is only for the local Compose service. Do not reuse it for deployment. The Compose file contains no application images. The [Verify workflow](.github/workflows/verify.yml) is intended to check a clean install, build, mapping tests, migration and empty API query against PostgreSQL. Until that workflow runs successfully, the full fresh-checkout path remains unverified.

For scope and acceptance criteria, start with [the roadmap](docs/roadmap.md). For field definitions and caveats, start with [the methodology](docs/data-methodology.md).
