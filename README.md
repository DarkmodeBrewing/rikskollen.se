# Rikskollen

Rikskollen is a proposed public, independent view of what happens in the Swedish Riksdag. It uses the Riksdag's open data to make members, assignments, recorded votes, decisions and their source documents easier to explore. The aim is to answer factual questions such as “How did this member vote on this proposal?” and “Which votes recorded this member as absent?” without assigning political scores or guessing motives.

**Status (2026-09-30):** M0–M3 implementation is merged: member directory, recorded votes, decision trails, decided-report catalog and scoped summaries. M4.0 prepares the first staging deployment; no server deployment or real-data staging acceptance has been recorded. See [project brief](docs/product.md), [methodology](docs/data-methodology.md), [roadmap](docs/roadmap.md), [staging runbook](docs/deployment.md) and [acceptance protocol](docs/m4.0-test-protocol.md).

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
| `apps/worker` | Fetch and normalize open data | Manual snapshot imports for members, 2025/26 votes, report statuses and the decided-report catalog; bounded report batches |
| `packages/shared-types` | Source and internal schemas | Member/vote source contracts and environment validation; API DTOs currently also live in the web service |
| `packages/db` | PostgreSQL/Drizzle models | Versioned import snapshots, six applied migration files and a compiled migration job; PostgreSQL integration tests |
| `apps/api` | Read API | Member/vote/report list and detail, filtered member history, coverage and scoped summaries; process health and DB readiness |
| `apps/webapp` | Angular web UI | Swedish directory, vote/history and decision views; SSR and same-origin API proxy; signals in M2/M3 views |
| `docker-compose.yml` | Local database | PostgreSQL only; API and webapp run on the host |
| `Dockerfile`, `compose.staging.yml` | Staging deployment | Separate API/web runtime images and migration/import jobs; host acceptance remains pending |

The separate legacy attendance schema remains a draft outside the applied migrations. Member assignments are stored as source-valued JSON within the imported person snapshot. Decision summaries count imported proposal points; member summaries count source vote rows. Neither establishes general attendance. The Angular upgrade and remaining `AsyncPipe` conversion remain in issue #4.

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

The database password above is only for the local Compose service. Do not reuse it for deployment. This development Compose file contains no application images; staging uses the separate [runbook](docs/deployment.md). The [Verify workflow](.github/workflows/verify.yml) checks clean install, build, mapping and batch tests, migration, repeat import and empty API query against PostgreSQL. The [Staging stack workflow](.github/workflows/staging.yml) builds runtime images and checks migration, readiness, SSR, the API proxy and restart/failure recovery with an empty database. These checks do not establish host or real-source acceptance.

For scope and acceptance criteria, start with [the roadmap](docs/roadmap.md). For field definitions and caveats, start with [the methodology](docs/data-methodology.md).

## M1 member directory

After the migration, set `RIKSDAG_API_URL=https://data.riksdagen.se` and run `corepack pnpm --filter @rikskollen/worker sync:persons`. The command fetches the Riksdag's unfiltered serving list, then its party-filtered batches, verifies each batch count and every stable ID against the roster, and writes one completed run and its persons in a transaction. Failed or incomplete fetches do not publish a run. Repeating the command updates source values by `intressent_id` without duplicating people. This is a manual import; no schedule or public deployment is configured.

`/api/persons?q=&page=1&limit=30` returns a searchable page and total count from the **latest completed run**; `/api/persons/:id` returns its member, including the source's assignment dates as text; `/api/import-status` reports the last run and its coverage. The Angular UI at `/` and `/ledamot/:id` uses these routes. Run the API on port 3000 and `pnpm dev:web` on port 4200; the dev server proxies `/api`. The SSR server on port 4000 proxies the same paths; set `API_BASE_URL` if the API is not at `http://localhost:3000` on the server. Empty state is expected before the first import.

The source's `personlista` interface did not paginate in the 2026-09-29 sample; `p`/`sz` did not limit the response. M1 uses party-filtered bounded batches and reconciles them against the full roster. A run does not archive raw source JSON; it stores per-person SHA-256, source URL, source-reported date, fetch time and the full set of assignment values for auditing. Older members remain stored but are omitted from the current directory after a later completed run. Assignment dates have no explicit source timezone and remain text. Member photographs are not displayed pending a rights review. The directory is not a record of general attendance or votes.

## M2 recorded votes

The first bounded vote session is **2025/26**. Set `RIKSDAG_API_URL=https://data.riksdagen.se`, run migrations, then run `pnpm --filter @rikskollen/worker sync:votes`. You can also pass the path of an already downloaded official `votering-202526.json.zip` archive to replay the exact bytes: `pnpm --filter @rikskollen/worker sync:votes /path/to/votering-202526.json.zip`. This is a manual job, separate from the member import. It may take time: the inspected archive contained 798 JSON vote files and 278,502 member choices. The archive is fetched into memory and bounded at 32 MiB compressed and 300 MiB expanded.

The worker verifies each file's vote ID, proposal point, session, 349 unique member IDs and consistent event fields. It writes a new run snapshot in batches and marks it complete only after every file has been ingested and the totals reconcile. A failed run is removed; a completed previous run remains visible. Each run retains the archive URL and SHA-256; each event retains its file name, source URL and per-file SHA-256. The source archive can be re-downloaded or supplied locally for replay. The archive itself is not stored in PostgreSQL.

The API routes `/api/votes`, `/api/votes/:voteId`, `/api/votes/import-status`, and `/api/persons/:id/votes` read only the latest completed 2025/26 snapshot. The UI offers a vote list, vote detail with each member choice, and a member's history. Dates missing in the source remain unknown. The M2 UI uses signals for its new asynchronous views; the broader Angular upgrade and conversion of the existing member templates are tracked separately in issue #4.

The member history now includes counts of each exact source choice for that person's ID, with the source-row denominator, missing person records, missing dates and import time. Clicking a count filters the event list; the summary still covers all rows for the ID in the snapshot. The optional API filter is `choice`, for example `/api/persons/:id/votes?choice=Ja&page=1&limit=20`. The response includes `summary` (null before a completed import) and the selected `choice`. Unexpected source values remain visible. These counts describe source records, not general attendance or eligibility; [methodology](docs/data-methodology.md#m3-member-vote-choice-summary-202526) defines the scope and provides a worked source example.

## M3 decision trail: first matter

After building and migrating, import the source document status for the first worked example:

```bash
pnpm --filter @rikskollen/worker sync:decision HD01TU8
```

The worker accepts one 2025/26 committee report document ID at a time. It fetches `dokumentstatus/HD01TU8.json`, validates every proposal point, and atomically publishes a versioned report snapshot with the source SHA-256. A later import of the same ID publishes a new version; the previous one remains stored. The service does not store the raw response or HTML, so exact historical replay requires saving the source response separately. No import is scheduled.

`/api/decisions/HD01TU8` and `/arende/HD01TU8` display the source's proposal text, point, decision type, winner where given, and source vote ID. A link to Rikskollen's vote detail appears only if the latest M2 snapshot contains that same document, point, and vote ID. Points labeled `acklamation` show that source classification and no vote link. If M2 or M3 has not been imported, no local connection is claimed. This first slice does not claim full session coverage or publish vote-pattern statistics.

## M3 vote-linked report batches

Once the M2 vote archive has been imported, run a bounded batch of reports whose IDs appear in its latest completed 2025/26 snapshot:

```bash
pnpm --filter @rikskollen/worker sync:vote-linked-decisions 10
```

The argument is the maximum **new** reports for this run (1–25, default 10). The command skips reports with a completed M3 import. Repeat it to continue; use `sync:decision ID` to re-fetch one report after a correction. Each report is an atomic snapshot; if one fetch or mapping fails, the batch stops, reports how many succeeded, and a later run resumes from the remaining IDs. It refuses unsupported document IDs rather than silently ignoring them. This is manual and requires the official document-status service to respond; no live batch was run as part of development.

`/api/decisions?page=1&limit=30` and `/arenden` list imported reports. The displayed coverage is **imported unique report IDs referenced by the latest M2 vote snapshot / unique non-null report IDs referenced by that snapshot**, for session 2025/26. Vote events without a verifiable report ID and reports with no recorded vote are outside that denominator; those reports require a separate document source before any session-wide decision coverage claim. The page labels this as import coverage, not an attendance or decision-rate statistic.

## M3 decided-report catalog

Import the official list of committee reports **marked decided** for 2025/26, then import missing report statuses in bounded batches:

```bash
pnpm --filter @rikskollen/worker sync:report-catalog
pnpm --filter @rikskollen/worker sync:catalog-decisions 10
```

The catalog uses `dokumentlista` with `doktyp=bet`, `rm=2025/26`, `beslutad=1`, and an explicit ascending date sort. It validates every page number, count, source filter, next-page link and unique document ID before one database transaction publishes the complete catalog. The 2026-09-30 sample returned 474 reports across 24 pages. A failed page leaves the previous completed catalog visible; source list responses are represented by per-page hashes and URLs, not raw JSON. Repeat the catalog import for upstream corrections. The second command imports up to 25 *missing* reports per run and resumes after a failed report; individual `sync:decision ID` can re-fetch a completed report.

The `/arenden` page now shows a second coverage figure: **imported document statuses / reports marked decided in the latest complete catalog**. When M2 is also imported it shows how many catalog reports have a matching recorded vote. Reports not marked decided are outside this denominator. This is data import coverage, not the share of parliamentary decisions made by a vote. A report can contain both voted and acclamation points; its detail page remains the place to inspect each point.

The same page and `/api/decisions` show a decision-method summary over proposal points in the **latest completed status for each imported catalog report**. It counts source-labeled `röstning`, `acklamation`, other values and missing values, with the point denominator and the number of catalog reports still missing status. A single report can contribute several points. This does not describe every decision in the session or member attendance; see [methodology](docs/data-methodology.md#M3-decision-method-summary-202526) for the exact scope and a TU8 example. Re-run `sync:catalog-decisions` to increase coverage or `sync:decision ID` to incorporate an upstream correction.
