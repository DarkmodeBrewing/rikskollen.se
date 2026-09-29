# Working on Rikskollen

This file applies to the whole repository. Follow the user's task and any more specific instructions in nested `AGENTS.md` files. Make the smallest coherent change that completes the task, and leave the result reviewable.

## Product and evidence

Rikskollen is an independent way to explore the Riksdag's public records. It should help a visitor answer factual questions and follow each claim back to its source. Read [the project brief](docs/product.md), [methodology](docs/data-methodology.md), and [roadmap](docs/roadmap.md) before changing data semantics or public-facing copy.

- Use the Riksdag's primary data as the source of truth. Preserve source IDs and URLs, retrieval times, source values and enough provenance to audit transformations.
- Distinguish source facts from derived values. Document the formula, denominator, period, exclusions and limitations of every published statistic.
- A member marked `Frånvarande` in a recorded vote was recorded absent **for that vote**. Do not turn vote records into claims about days at work, motives, illness or general attendance.
- Recorded votes do not cover every decision. Model proposal points, vote events, member choices, documents and decisions separately where the source requires it; avoid collapsing them into one misleading row.
- Treat missing or malformed source data as unknown, not as `Nej`, `Avstår` or `Frånvarande`. Surface incomplete coverage and known deviations rather than hiding them.
- Do not introduce political scores, rankings, inferred intent or partisan commentary as product output. Keep Swedish UI wording precise and understandable.
- Attribute data as “Källa: Sveriges riksdag”, identify Rikskollen as independent, and review image rights and personal-data handling before public use.

## Repository boundaries

- `apps/worker`: fetch, validate, normalize and ingest source data.
- `packages/shared-types`: contracts shared across packages; distinguish external source schemas from internal/API DTOs.
- `packages/db`: database schema, migrations and persistence concerns.
- `apps/api`: read-oriented application API; do not use a request handler as an ingestion job.
- `apps/webapp`: accessible Swedish UI with source links and visible coverage/freshness.

These are intended responsibilities, not proof that every package currently works. Inspect the implementation before changing it. Avoid importing worker clients into shared types or coupling the browser app directly to database internals.

## Engineering workflow

1. Read the affected code and docs, identify the actual baseline, and state assumptions where the source or requirements are unclear.
2. For ingestion changes, use bounded and paginated requests, stable upstream identifiers, idempotent writes, explicit failure handling and a correction/replay path. Do not silently discard pages or individual records.
3. Keep migrations explicit and reversible where feasible. Do not modify production data, credentials, hosting or external services as an incidental step.
4. Add focused tests for meaningful behavior and failure modes: source-shape variation, pagination, mapping, idempotency, provenance and aggregate denominators as applicable. A fixture should identify its source and capture the relevant edge case.
5. Run the relevant build, tests and smoke checks. Report exactly what ran, what failed and what was not verified. Do not claim that Compose, CI, ingestion or the site is operational just because configuration files exist.
6. Update the README or methodology when setup steps, data definitions, coverage or public wording change. Keep a change scoped to the task; avoid opportunistic rewrites.

Use pnpm workspace commands from the repository root unless a package explicitly requires otherwise. Check scripts before invoking them: this prototype contains unfinished paths. Never commit secrets, local `.env` files or raw personal-data dumps. When proposing a public metric, show a source-linked worked example before shipping it.
