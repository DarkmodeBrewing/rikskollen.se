# M4.3 first slice — import status from worker to UI

Merged through PR #18 after page identity/sharing PR #17. Functional host acceptance was confirmed by Lars on 2026-10-08; see [the deployment check record](m4.3-test-protocol.md). This slice adds durable operational history, a read API and `/datastatus`. It does not enable a scheduler, change the source sessions, run live imports or complete the host's pending report statuses.

## Worker contract

Migration `0006` adds `import_attempts`, independent of the existing published snapshot tables. Every invocation of the six import functions records its job, dataset, optional session/document ID and start time before fetching or selecting candidates. A normal finish records `succeeded`, end time, published count and the snapshot ID where there is one. Source/mapping/persistence failures record `failed`; technical exception text stays in worker stderr and is not stored or published.

The planned count is null until the source/selection has established it. Counts mean members for `persons`, vote events for `votes`, catalog reports for `report-catalog`, and report statuses for the three decision jobs. A report's proposal-point count is a separate coverage statistic. Source validation and snapshot publication rules remain unchanged. Votes staged before an abort are removed and count as zero published events.

Each completed report is a separate atomic snapshot and separate attempt, even when invoked by a batch. A batch records its selected count and advances its published count after each completed report. If its second report fails after one succeeds, its outcome is failed with 1 of 2 published reports; the successful child remains available. Resuming selects missing reports and does not re-fetch the completed one. Batch and child attempts are not an additive dataset total.

A process killed before final logging leaves `running` with no end time. Public wording is “Slutstatus saknas”: it can mean active or interrupted, not proven failure or activity. No heartbeat/timeout inference is introduced. If the database is unreachable, recording an attempt or its completion may itself fail; logging cannot guarantee a durable record during database loss. If publication succeeds but final tracking fails, the unfinished attempt remains unknown; coverage is still read from the published tables. Old failed attempts are not reconstructed; old completed snapshots still supply coverage. There is no automatic history pruning in this slice.

## Read API and count definitions

`GET /api/data-status?page=1` returns a shared typed DTO with generated time, earliest recorded attempt, published coverage, latest attempt per job, and 20 history entries ordered by start time/ID descending. Page is an integer 1–10000. Queries share a read-only repeatable-read transaction so an import completing mid-request cannot mix snapshot references and counts. The endpoint performs no upstream calls, scheduling or writes.

| Card | Numerator | Denominator | Freshness |
| --- | --- | --- | --- |
| Members | Actual persons belonging to latest completed member run | Source expected roster count | Completed member snapshot time |
| Votes, 2025/26 | Actual events in latest completed session snapshot | Validated source archive file count | Completed vote snapshot time |
| Decided reports, 2025/26 | Actual entries in latest completed catalog | Reconciled source list count | Completed catalog snapshot time |
| Report statuses, 2025/26 | Catalog IDs joined to their latest completed status in the same session | Actual IDs in latest completed decided catalog | Oldest and newest completed status times within this numerator |

Members reconcile stored import counts against actual rows. Votes also reconcile actual choice rows against stored choice count and 349 rows per event, following the existing importer contract. A discrepancy is surfaced as incomplete. Missing snapshots have no invented denominator or refresh time. A catalog with zero imported statuses shows zero of its known count and null status times. Status coverage's `snapshotId` identifies the **catalog boundary**, not a single report version; its source URL is that catalog's source list.

Status corrections replace the old version's points in coverage. Pending versions, statuses from other sessions, and reports outside the catalog are excluded. The separate secondary counts are actual vote-choice rows and actual proposal points in the covered latest status versions. Missing reports have an unknown number of points. Without a catalog, standalone imported report statuses cannot establish catalog coverage.

Worked fixture: catalog contains the source-linked [TU8](https://data.riksdagen.se/dokumentstatus/HD01TU8.json) and one synthetic report. TU8's corrected status has one synthetic point; the old two-point version and a newer pending version are excluded. Result: 1 of 2 report statuses, one imported point. A completed report from a different session does not fill the missing status. This is fixture evidence, not a deployed session total.

Import time is not the source's last-change time, proof of current source completeness, or a freshness SLA. The diagrams use `importedCount / expectedCount` within each stated source selection. No parliamentary participation or attendance rate is introduced.

## Frontend

Footer navigation links to `/datastatus`; it has branded Swedish SSR/browser/Open Graph metadata and a sitemap entry. Coverage bars have accessible labels and exact counts. Attempt outcomes and history are readable at desktop/mobile widths; history pagination is URL-preserved and data can be refreshed/retried. Loading, unavailable API, missing snapshots and empty history are separate states. Timestamps use `Intl` with `Europe/Stockholm` including daylight saving, identically in SSR and the browser. The page now distinguishes manual and scheduled attempts and unchanged checks, without claiming that a scheduler is currently running, and links primary sources and the repository methodology.

## Verification and deployment acceptance

Local verification:

- Workspace production build, explicit worker/API TypeScript checks, E2E TypeScript check and `git diff --check` passed.
- All 46 Playwright desktop/mobile/browser/SSR cases passed using local Chromium 153. The six status cases passed again after adding keyboard retry and updating review captures.
- Seven Angular unit tests passed, including winter/summer Stockholm timestamp conversion.
- All 25 backend source/mapping/worker/API tests passed without skips against a temporary PGlite PostgreSQL engine adapter. Three API tests passed again after adding actual member/vote count checks, corrected/pending snapshot isolation and incomplete vote-choice detection. This is not evidence of a PostgreSQL server/container test.
- All seven migrations applied on an empty PGlite database and replayed without duplicate changes using the production Drizzle migrator.
- Desktop/mobile coverage captures were reviewed with synthetic fixture counts: [desktop](design/m4.3/datastatus-desktop.png), [mobile](design/m4.3/datastatus-mobile.png).

PR #18 passed all three CI workflows, including PostgreSQL 18 tests and container checks. Functional host checks passed on 2026-10-08; [the acceptance record](m4.3-test-protocol.md) distinguishes observed results from deployment metadata not supplied. Temporary PGlite/Chromium adapters are outside the deliverable and are not project dependencies.

Before starting the updated API or worker, build images and apply migrations using the existing [deployment runbook](deployment.md). Readiness now checks `import_attempts`, so an old schema does not appear ready. No new environment variables are required. Do not run a bulk live import merely to test this page.

On the host, verify the footer route, source-linked coverage, Swedish times and existing successful snapshot times. Run one normal bounded import and compare worker output, newest attempt and snapshot count/time. Verify a safe failing fixture locally/CI; do not deliberately disrupt the live source. Repeated bounded catalog batches remain the supported manual way to expand report status coverage. The scheduler slice implements opt-in scheduling and bounded corrections; see [scheduled imports](scheduled-imports.md). Alerts and retention policy remain M4.4 work.

## Scheduled-import extension

Migration `0007` adds public `trigger` and `unchanged` fields; the new `refresh-decisions` job uses the same decisions dataset. Scheduled source checks and publication times remain distinct. See [policy, deployment and separate host acceptance](scheduled-imports.md).
