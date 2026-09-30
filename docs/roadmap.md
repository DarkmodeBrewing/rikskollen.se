# Roadmap

Status as of 2026-09-30. This is an ordered proposal, not a delivery schedule. Each milestone must leave a demonstrable, source-linked result.

| Milestone | Outcome | Acceptance gate |
| --- | --- | --- |
| **M0 — Reproducible prototype** | Establish a reliable local baseline | Fresh checkout can install, build and run documented smoke checks; fix package boundaries and broken scripts; database migrations and a local stack run repeatably; CI runs those checks. Record known limitations. |
| **M1 — Member directory** | Persist one bounded set of Riksdag members and assignments | Paginated fetch; schema mapping handles observed shapes; idempotent import into Postgres; API and Swedish UI list/detail pages; stable IDs, source links, timestamps and import coverage are visible. |
| **M2 — Recorded votes** | Show who voted what on a vote | Import every page for one named session; store vote events and individual choices separately; link proposal point, matter/document and person; reconcile selected counts with source; UI has vote detail and member vote history. |
| **M3 — Context and careful summaries** | Explain decisions and vote patterns | Document/decision trail includes relevant points and identifies decisions without recorded votes; any aggregate has a published numerator, denominator, period and exclusions; vote absence is not presented as general attendance. |
| **M4 — Public release** | Operate an independent, transparent site | Repeatable deployment, scheduled imports with correction window, monitoring and failure alerts, backups/restore check, accessibility review, source and photo attribution, personal-data review, and visible freshness/coverage status. |
| **Later** | Wider history and richer activity | Backfill and reconcile additional sessions; speeches/motions/committee context and public API only where the evidence and maintenance cost justify them. Government-formation status remains separately scoped. |

## Immediate work queue for M0

1. Run `pnpm install --frozen-lockfile`, root build and existing tests from a clean checkout; record failures before changing code.
2. Resolve the API/worker/shared-types boundaries, undefined database references and source schema mismatches. Do not merely make TypeScript pass while the mapping rejects real records.
3. Make local Postgres and migrations repeatable. Fix Compose build paths/Dockerfiles or document a verified non-Docker development route.
4. Add a smoke fixture for one person and one recorded vote from a documented source sample, plus ingestion failure/pagination cases that matter to the first slice.
5. Add CI and replace the README's unverified setup note with commands proven on a fresh checkout.

## Decisions to validate during M0/M1

- Select the first session and backfill window after inspecting source volume and completeness.
- Decide whether a raw response store or a versioned snapshot reference is sufficient for correction history.
- Confirm exact source identifiers, vote/point/document relationships, substitution and assignment semantics using real records.
- Establish initial sync cadence and acceptable lag from source publication; show actual last successful sync, not a promise of “live” data.

The next vertical slice is **member → recorded vote → proposal/document → primary source**, with enough provenance to audit every displayed claim.

## M3 first slice — one complete decision trail

Use the 2025/26 committee report TU8 (`HD01TU8`) as a source-linked example. Import all its proposal points from document status as one versioned report; display each point's proposal, decision method and source vote ID, including points decided by acclamation. Join to M2 only by the verified document, point and vote ID. Keep missing context unknown. Then check a second report's shape and expand bounded imports before any session-wide claim. Define and validate denominators and exclusions before publishing aggregates. The Angular upgrade and broader signals conversion remain separate in issue #4.
