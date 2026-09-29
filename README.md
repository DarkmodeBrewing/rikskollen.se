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
| `apps/worker` | Fetch and normalize open data | Manual member import and experimental vote client |
| `packages/shared-types` | Source and internal schemas | Member and vote source schemas; later data contracts still need validation |
| `packages/db` | PostgreSQL/Drizzle models | Persons and import runs migrations; repeat import test runs with PostgreSQL |
| `apps/api` | Public read API | Health, paged person list/detail and import coverage routes |
| `apps/webapp` | Angular web UI | Swedish member list and detail pages |
| `docker-compose.yml` | Local database | PostgreSQL only; API and webapp run on the host |

The vote and attendance schemas remain drafts outside the applied migration. Member assignments are stored as source-valued JSON within the imported person snapshot; a normalized assignments table remains a draft. The next milestone is recorded votes.

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

The API listens on port 3000 by default. `/health` reports process health; `/api/persons` reads the latest completed import and returns `{ "items": [], "total": 0, "page": 1, "limit": 30 }` before any import. Start Angular separately with `pnpm dev:web` (port 4200). The worker's `dry:vote-cases` command fetches and prints a small sample; it does **not** ingest data. To run it, set `RIKSDAG_API_URL=https://data.riksdagen.se` and use `pnpm --filter @rikskollen/worker dry:vote-cases`.

The database password above is only for the local Compose service. Do not reuse it for deployment. The Compose file contains no application images. The [Verify workflow](.github/workflows/verify.yml) checks clean install, build, mapping and batch tests, migration, repeat import and empty API query against PostgreSQL.

For scope and acceptance criteria, start with [the roadmap](docs/roadmap.md). For field definitions and caveats, start with [the methodology](docs/data-methodology.md).

## M1 member directory

After the migration, set `RIKSDAG_API_URL=https://data.riksdagen.se` and run `corepack pnpm --filter @rikskollen/worker sync:persons`. The command fetches the Riksdag's unfiltered serving list, then its party-filtered batches, verifies each batch count and every stable ID against the roster, and writes one completed run and its persons in a transaction. Failed or incomplete fetches do not publish a run. Repeating the command updates source values by `intressent_id` without duplicating people. This is a manual import; no schedule or public deployment is configured.

`/api/persons?q=&page=1&limit=30` returns a searchable page and total count from the **latest completed run**; `/api/persons/:id` returns its member, including the source's assignment dates as text; `/api/import-status` reports the last run and its coverage. The Angular UI at `/` and `/ledamot/:id` uses these routes. Run the API on port 3000 and `pnpm dev:web` on port 4200; the dev server proxies `/api`. The SSR server on port 4000 proxies the same paths; set `API_BASE_URL` if the API is not at `http://localhost:3000` on the server. Empty state is expected before the first import.

The source's `personlista` interface did not paginate in the 2026-09-29 sample; `p`/`sz` did not limit the response. M1 uses party-filtered bounded batches and reconciles them against the full roster. A run does not archive raw source JSON; it stores per-person SHA-256, source URL, source-reported date, fetch time and the full set of assignment values for auditing. Older members remain stored but are omitted from the current directory after a later completed run. Assignment dates have no explicit source timezone and remain text. Member photographs are not displayed pending a rights review. The directory is not a record of general attendance or votes.
