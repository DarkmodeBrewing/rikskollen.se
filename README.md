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
| `packages/db` | PostgreSQL/Drizzle models | Draft schema and mappings, not yet an established ingestion pipeline |
| `apps/api` | Public read API | Health/example routes and a person route under development |
| `apps/webapp` | Angular web UI | Starter application |
| `docker-compose.yml` | Local stack | Draft with stale build paths; not a verified setup |

These are implementation directions, not claims of working features. The first milestone is to get one traceable person → recorded vote → source document path working end to end.

## Starting point for contributors

The workspace uses pnpm 9 and TypeScript. The package scripts are in the root `package.json`. A fresh install, build, database migration, ingestion and Docker run have **not** been verified for this documentation pass; setup instructions will be added when M0 establishes a reproducible path. Do not treat the current Compose file as deployment instructions.

For scope and acceptance criteria, start with [the roadmap](docs/roadmap.md). For field definitions and caveats, start with [the methodology](docs/data-methodology.md).
