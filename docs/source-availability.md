# Structured decision-source availability

This slice separates a verified source response without structured proposal points from an import execution failure. It is not an exemption for FiU10: the rule applies to any correctly identified 2025/26 committee report whose validated document status omits `dokutskottsforslag` or provides an empty proposal array. FiU10's inspected response and compilation context are recorded in [methodology](data-methodology.md#source-shape-review-2026-10-11).

## Meaning and provenance

A source check records document ID, session, availability (`available` / `unavailable`), the fixed reason `structured-points-missing` where applicable, source URL, response SHA-256 and database check time in `decision_source_checks`. Observations are append-only. They identify the latest verified shape, not a guarantee that upstream content is unchanged. Fetch errors, wrong IDs/sessions, malformed sections, duplicate points and invalid vote IDs remain failed attempts and do not replace the last verified observation. Raw response bytes are not archived.

An unavailable result has no snapshot ID and an unknown point count (`null`); no zero-point decision snapshot is created. Earlier completed snapshots remain available. When structured points return, a normal complete import records an available observation; unchanged rechecks also record availability without replacing the published version.

`import_attempts.unavailable_count` defaults to zero for historical attempts. A successful source check can have status `succeeded`, imported count zero and unavailable count one. The status describes execution of the check, not completeness of the dataset. Parent batches count published and unavailable reports separately, retain those counts on a later failure, and fail for real fetch/validation errors. Previously failed attempts remain unchanged in history.

## Scheduling and alerts

Catalog and vote-linked missing-report selection excludes a latest unavailable observation for 24 hours. After that delay the report becomes eligible again, subject to the existing bounded batch size/order and scheduler tick. Other missing reports continue through the batch. Reports with an older published snapshot follow the existing correction rotation (daily for recent source dates, seven days for older dates). Manual single-report invocations always check immediately.

The monitor continues to report failed, abandoned and overdue parent jobs. A successful catalog check can clear an earlier execution-failure incident even while source details remain unavailable. This is job recovery, not source-data recovery. Partial decision coverage stays allowed, as before; missing details remain explicitly visible in Datastatus and the catalog denominator. Source unavailability has no separate webhook incident in this slice. Do not reset monitor state to manufacture recovery.

## Read API and UI

`/api/data-status` adds `sourceAvailability`: a count of latest unavailable observations joined to the latest complete 2025/26 catalog, plus at most 20 reports ordered by oldest check then document ID. Each item contains the catalog title, ID, reason, source URL, check time and whether a prior completed detail snapshot exists. Other sessions, reports outside the current catalog and superseded unavailable observations are excluded. The count is an overlapping source-availability measure, not an additional number to subtract from imported coverage: an unavailable report can still have a prior published snapshot. Decision coverage cannot be marked complete while a current catalog report's latest verified observation is unavailable.

Datastatus displays these source gaps separately with source links and check times, explains that missing points do not mean zero decisions, identifies retained older details, and distinguishes checked-unavailable attempts from completed publications. Other listing/detail routes retain their existing coverage and missing-import behavior. Unknown fields are additive for existing clients.

## Deployment and acceptance

Migration `0008_next_kabuki` creates the observation table and adds the unavailable count. Apply it before starting the new API or scheduler. API readiness checks the new schema. Build the migration, API, worker and web images at the same revision; monitor/scheduler reuse the worker image. Retain the database and monitor volumes.

```bash
export GIT_SHA=$(git rev-parse HEAD)
export IMAGE_TAG=$GIT_SHA
dc build migrate api worker web
dc stop scheduler
dc run --rm migrate
dc up -d --wait api web
# Verify the source gap without publishing invented points.
dc run --rm worker dist/sync-decisions.js HD01FiU10
dc --profile scheduled-imports up -d --force-recreate scheduler
curl --fail --silent --show-error https://rikskollen.se/api/data-status
```

Recreate an already-enabled monitor separately with the new worker image. Do not start monitoring implicitly or discard its acceptance state. Verify FiU10 returns `availability:unavailable`, null snapshot/point count and source hash, a successful check with unavailable count one, unchanged published decision coverage and a source-gap row in Datastatus. Subsequent catalog passes should exclude its fresh unavailable observation, and a later eligible pass should recheck it. Test batch/job recovery separately from source availability and actual webhook delivery.

Rollback requires first stopping the new worker/API and restoring the prior application revision. The additive columns/table may remain for an application rollback; dropping them destroys availability evidence, so back up before any schema rollback. No production data was modified during implementation.

Implementation tests cover source identity/shape rejection, no invented snapshots, 24-hour exclusion/recheck, return to available data, retention of prior versions, real failure preservation, scoped API counts, and SSR/desktop/mobile presentation. Database integration, packaged migration/restore and deployed checks require their respective environments; local test execution does not pass host acceptance.

### Local verification (2026-10-11)

- Workspace build, worker/API TypeScript checks, E2E type check and diff whitespace check: PASS.
- Worker suite: 25 passed, 14 skipped (database-dependent cases and CI-only HTTP receiver).
- Browser-free SSR suite: three passed, including the new source-gap/denominator scenario.
- Desktop/mobile browser acceptance: BLOCKED locally. Chromium was absent and the browser download failed; browser assertions have not been verified.
- PostgreSQL integration/migration, CI container checks and host source-gap/recovery acceptance: NOT RUN in this slice yet.

The known text-decoding and report-singular wording defects are recorded in the monitoring runbook and remain outside this implementation.
