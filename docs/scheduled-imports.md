# M4.3 — scheduled source checks and corrections

This slice adds an **opt-in** worker scheduler for the existing 2025/26 dataset. It does not activate imports on a host. Apply migration `0007` before starting the new API or worker. The previous [import-status acceptance](m4.3-test-protocol.md) remains evidence for that slice; scheduler host acceptance is separate below.

## Policy and evidence

The scheduler checks due work at startup and every 15 minutes after a pass. Due times are persisted indirectly through `import_attempts`, so restarting does not reset completed-job intervals. Jobs run sequentially; a failed job does not prevent other due jobs from running. Manual attempts also count towards due times. Successful jobs use their finish time; failed or abandoned jobs have a one-hour retry delay. No cron/time-zone boundary is involved.

| Job | Interval after success | Bound |
| --- | --- | --- |
| Member directory | 24 hours | Existing reconciled roster and party batches |
| 2025/26 vote archive | 24 hours | Existing 32 MB compressed / 300 MB expanded / 2,000-file caps |
| 2025/26 decided-report catalog | 24 hours | Existing paginated, reconciled catalog caps |
| Missing decision reports | 1 hour | `IMPORT_BATCH_LIMIT`, default 10, maximum 25 reports |
| Decision corrections | 24 hours | Same batch limit, split between recent and older reports |

These are provisional operating choices, not a Riksdag update guarantee or a public freshness SLA. The official [vote dataset catalog](https://data.riksdagen.se/dataset/katalog/dataset-votering.html) was observed with a 2025/26 archive timestamp of `2026-10-07 07:40:27` in a cached search result and `2026-10-08 06:47:11` on the live catalog on 2026-10-08. This is limited evidence of daily archive regeneration; it does not establish when individual source records changed. There is no equivalent measured update schedule established here for directory, catalog or status records. Daily checks are a starting point to measure against host attempt history and source changes.

Under healthy operation, daily jobs are checked roughly every 24 hours plus the next 15-minute tick and time spent running a pass. A whole pass has a 30-minute process deadline. Actual lag, retries, pending coverage and storage growth must be measured before accepting a service target. This slice retains all changed snapshots and attempt history; retention, alerting and backup/restore remain M4.4 work.

## Correction selection

Only reports in the latest completed decided-report catalog for 2025/26 are eligible. Missing reports use the existing resumable import path. Scheduled batches attempt every selected report even if one fails, retain completed reports and mark the parent batch failed with its actual published count. Manual catalog batches keep their existing stop-on-first-failure behaviour. Corrections select already imported reports:

- Recent: a valid source date within the last 30 UTC calendar dates (including today), not in the future, and no successful status check in the preceding 24 hours.
- Older or unknown source date: no successful status check in the preceding seven days.
- The recent group gets half the batch (rounded up); the older group gets the rest. At a limit of one, the reserved group alternates by UTC day. Unused slots go to the remaining oldest eligible checks. Within each group, oldest successful check comes first, with document ID as a stable tie-breaker.

The last check is the later of the completed snapshot time and a successful per-document `decision` attempt. An unchanged result therefore advances the operational check time without changing publication freshness. Failures never advance a successful check. Each selected correction is attempted once per batch; one failed report does not prevent the other selected reports being checked. A partially failed parent batch records its actual published count and ends failed.

The window and budget deliberately do not promise all reports are refreshed daily. With the current historical session, most source dates will be outside the recent window and use the older rotation. A source change outside a batch remains undetected until that report is checked. Use the normal single-report command to force a correction/replay when needed. Current-session imports and broader history remain separately scoped.

## Publication, unchanged checks and overlap

All manual import entry points and the scheduler share PostgreSQL session advisory lock `724031`. A scheduled pass holds it across all its due jobs; nested batch/report imports reuse ownership. An overlapping scheduled pass logs `busy` and performs no source fetch. An overlapping manual command records a failed attempt, exits nonzero and performs no source fetch. Retry it after the owning import ends. The lock is released on normal completion/failure and by PostgreSQL on process disconnect. Losing the lock connection terminates the worker rather than allowing writes without ownership. This assumes every writer uses these entry points; it is not a substitute for database permissions.

For scheduled votes, source-file names and SHA-256 hashes are compared to the latest completed snapshot, including actual event/choice counts. Repacking an identical ZIP does not create another 349-choices-per-event snapshot. Any changed file or membership causes the existing full validation/reconciliation import. Scheduled corrections fully fetch and parse each status, then compare its source hash and point count. Changed versions retain existing atomic publication rules. Manual vote/status commands continue to publish explicit replay versions.

Migration `0007` adds `trigger` (`manual` by default for historical attempts) and `unchanged` (`false` by default). The API and `/datastatus` expose both. A successful unchanged check has zero newly published records, an existing snapshot ID, and the label **Kontrollerad – oförändrad**. Parent batch and child report attempts are separate; do not sum them as independent records. The page describes actual recorded starts and outcomes, not whether a daemon is currently alive. A hard stop/deadline can leave an unfinished attempt and incomplete staged vote run; neither becomes published coverage. Automatic cleanup of abandoned staging/history is deferred to retention work.

## Deployment and rollback

Use the existing [deployment runbook](deployment.md), with its `dc` alias and tested `GIT_SHA`/image tag. Stop any previous scheduler and allow other import jobs to finish before upgrading:

```sh
dc stop scheduler
dc build api web worker migrate scheduler
dc run --rm migrate
dc up -d --wait api web
```

An ordinary `dc up` does not enable the scheduler because it has the `scheduled-imports` profile. Review the policy and current coverage first. **The following commands perform live imports**, including pending-report backfill:

```sh
# Validate configuration without source requests or database writes.
dc run --rm worker dist/scheduler.js --check

# One pass, useful for reviewing recorded outcomes before enabling repetition.
dc run --rm worker dist/scheduler.js --once

# Explicitly enable repeated imports.
dc --profile scheduled-imports up -d scheduler
dc logs --tail=100 scheduler
```

Set `IMPORT_BATCH_LIMIT=1` in the deployment environment for a smaller initial batch, rebuild/recreate the scheduler as appropriate, and use `-e IMPORT_BATCH_LIMIT=1` for a one-off worker pass. Do not run an external cron as well as this daemon. Manual commands remain available; they fail early if another import owns the lock. A busy `--once` pass logs `busy` and returns success because it performed no work; a pass containing a failed job exits nonzero. The daemon keeps running after job failures, which remain visible in the API and logs.

Disable with `dc stop scheduler`; confirm the container stopped before changing versions. SIGTERM stops future passes and waits for current work until Compose's 30-second grace expires; a forced stop leaves completed snapshots usable and releases the session lock. Rolling back application images can leave the additive columns in place. To remove them later, first stop all new workers/API instances, then explicitly drop `unchanged` and `trigger`; this destroys those operational fields and requires coordinated migration-history handling, so leaving the additive migration is preferred.

## Acceptance record

Implementation checks use source fixtures; they never run live scheduled passes. CI's Verify workflow runs the migration and database tests against PostgreSQL 18, including independent-session contention and nested-lock/release behaviour. Local PGlite checks can exercise publication/query behaviour but **cannot validate PostgreSQL session locks**. Browser tests cover SSR and hydrated desktop/mobile manual/scheduled/unchanged labels with unchanged coverage times.

Local verification on 2026-10-08: workspace build and worker/E2E type checks passed; the PGlite-backed full fixture suite passed 30 tests with the independent-session lock test skipped. The subsequently expanded scheduler suite passed six tests with that same lock test skipped, including persisted due-time restart behaviour. All 46 Chromium desktop/mobile browser tests passed. Migration history applied to a fresh PGlite database and replayed without change. The temporary adapter bypassed advisory-lock calls; these results are publication/query evidence, not PostgreSQL lock or Compose acceptance. CI results for this slice are not recorded here. Subsequent host observations are recorded in the [M4.3 test protocol](m4.3-test-protocol.md#scheduled-import-slice--host-verification-2026-10-0809).

| Host check | Status | Required evidence |
| --- | --- | --- |
| Exact deployed commit/images and migration `0007` | PARTIAL | Migration completed and readiness recovered; exact revision/images and journal/replay not recorded. |
| Opt-in service and one bounded scheduled pass | PASS | Limit 1 initial pass and overnight backfill; recreated daemon confirmed limit 10 and published a 10-report batch. |
| Restart respects successful-job due times | PASS (observed paths) | Empty immediate/recreated passes, followed by due member retry and missing-report batches. |
| Manual/scheduled overlap performs no second fetch | PARTIAL | Scheduled contender returned `busy`; manual overlap/source-request instrumentation not performed on host. |
| Changed and unchanged checks preserve correct freshness | PASS (observed paths) | TU8 reuse preserved all API coverage objects; votes published then reused the new snapshot. Mobile history confirms zero new versions on the vote repeat; its coverage timestamp was not separately captured. |
| Failure preserves completed data and retries are bounded | PARTIAL | Earlier controlled manual member failure preserved coverage; scheduler retry succeeded after cooldown. Scheduled partial failure/deadline not induced. |
| Recent/older correction selection and pending backfill | PARTIAL | Bounded backfill verified; all 28 imported reports were ineligible for correction. Eligible selection/rotation pending. |
| `/datastatus` on desktop/mobile and disable/restart | PARTIAL | Desktop labels and mobile unchanged history readable; recreation verified, explicit disable not recorded. Known report singular wording defect remains open. |

The daemon was observed operating on October 8–9; acceptance remains partial with the boundaries above. Review measured lag and request/storage load over several days before choosing an accepted cadence or alert threshold.
