# M4.4 — database backup and isolated restore

This first operational-recovery slice provides manual backup and restore verification. Alerts, automated backup delivery, retention pruning and full disaster-recovery acceptance remain separate work. The scheduler's open correction-selection checks and the report singular wording defect remain tracked in the [M4.3 protocol](m4.3-test-protocol.md).

## Backup boundary

The backup is a PostgreSQL custom-format logical dump of the complete application database, including historical versions, source URLs/hashes, operational attempts and the migration journal. `pg_dump` reads a consistent database snapshot while imports may continue; imports committed after its snapshot are not included. It does not back up roles/passwords, deployment configuration, image artifacts, proxy/WireGuard configuration or raw upstream archives. Restore verification intentionally omits original ownership and grants and uses a disposable owner. A real recovery must provision application roles and privileges separately.

A SHA-256 sidecar detects accidental corruption, not malicious replacement of both files. Bundles contain public member records and operational metadata: keep them private and do not commit or publish them. The script creates a new directory with mode 700 and files under umask 077; existing directories are refused. `/backups` is excluded from Git and image build contexts. An archive alone is not a verified backup.

## Host commands

Run from the repository root on the Linux host. Requires Bash, Docker/Compose, Git and GNU `sha256sum`; no host Node or PostgreSQL installation is needed. These scripts invoke Compose directly rather than using the interactive `dc` alias. Supply the same project, environment file, compose file and any host-specific override used for the deployment. Do not print the resolved Compose configuration because it includes credentials.

```bash
export GIT_SHA=$(git rev-parse HEAD)
export IMAGE_TAG=$GIT_SHA
mkdir -p backups
bundle="backups/$(date -u +%Y%m%dT%H%M%SZ)"
bash scripts/backup-db.sh "$bundle" \
  -p rikskollen-staging --env-file deploy/staging.env -f compose.staging.yml
bash scripts/verify-restore.sh "$bundle"
cat "$bundle/metadata.txt"
cat "$bundle/restore-report.txt"
```

The restore script launches a unique PostgreSQL 18 container and volume with `--network none`, no host port and no application services. It restores through stdin, stops on SQL/restore errors, checks the migration journal and operational schema, and reports retained table counts and snapshot provenance. It then removes only its own container and volume. Failed startup/restore/assertions also trigger cleanup; cleanup failures are reported with resource names. A host crash or SIGKILL can bypass traps: inspect orphaned `rikskollen-restore-*` resources and their exact identity before removing them. Never remove the application's `db_data` volume.

`RESTORE_POSTGRES_IMAGE` may pin a tested PostgreSQL 18 image/digest; record the actual image ID in the report. Allow enough disk space for the dump and another full restored database plus indexes. Do not use a shared production volume as the restore target. Verification does not connect to the live database, fetch Riksdag data or start the scheduler.

A successful report means the archive restored and these schema/query checks passed. It is not proof of current API/UI behaviour, original role grants or equality with a later live database. Table counts include historical and incomplete versions, unlike `/api/data-status` coverage. Compare restored completed snapshot IDs/hashes and counts with the recorded backup-time evidence, accounting for imports committed after the dump snapshot. Keep reports private; share only necessary counts/IDs in the acceptance protocol.

For fixture acceptance, an optional second argument to `verify-restore.sh` supplies additional SQL assertions executed only inside the isolated restore. CI uses this to check known vote choices, parent/child linkage, provenance, timestamps and scheduled unchanged attempt history. The deliberately failing assertion checks cleanup; a corrupted archive checks checksum rejection. No live-source jobs run in this test.

## Storage and recovery policy

Before a migration, take a backup and verify an isolated restore. Retain the previously accepted application image IDs and the matching configuration securely. Copy the complete verified bundle to a separately protected off-host destination; this slice does not perform that transfer or claim off-host durability. Recheck the checksum and repeat the isolated restore after transfer. Do not delete the last verified pre-migration backup. Automatic frequency, encryption/off-host transport, retention limits, recovery point objective and recovery time objective must be agreed and measured before backup operations are accepted. No snapshots, attempt history or archives are pruned by these scripts.

A real recovery should first stop imports, provision an isolated replacement database with the required roles, restore the verified archive, validate application readiness and source-backed coverage with the compatible application images, then explicitly switch the application connection. Keep the original database untouched until recovery is accepted. These scripts implement the verification step; they do not automate production cutover or destructive in-place restore.

## Acceptance record

| Check | Status | Evidence required |
| --- | --- | --- |
| Script syntax and rejection of invalid input | PASS locally | `bash -n`; missing arguments rejected; existing bundle/sentinel preserved; checksum mismatch rejected before Docker |
| PostgreSQL 18 fixture dump/restore | PASS in CI | PR #23 Staging stack run 37904965567 restored synthetic records and passed provenance/count/history assertions |
| Failure cleanup and corrupted archive rejection | PASS in CI; host failure scenarios NOT RUN | Deliberate assertion failure and checksum mismatch observed; workflow's container/volume cleanup assertions passed |
| Real host backup and isolated restore | PASS (database restore scope) | October 9 host evidence below: exact script revision/image IDs, checksum, restored schema/provenance, cleanup and timed repeat |
| Off-host copy and restore from copied bundle | NOT RUN | Protected destination, checksum and second restore evidence |
| Application recovery/cutover | NOT RUN | Compatible schema/images, roles, readiness and coverage checks |
| Alerts and measured retention/recovery targets | Following slice | Verified failure/recovery notifications and selected policy |

## Host verification — 2026-10-09

**Database backup and isolated restore: PASS. Overall M4.4 acceptance remains partial.** Tester: Lars, host `darkmode01`, repository `/home/deploy/sites/rikskollen.se`. Evidence is supplied command output and the restore report; no remote host commands were run by the coding agent. Off-host durability, application recovery/cutover, alerts and policy targets remain unverified.

The checked-out script revision was `ab1dc5c17476c9ae515fd51c53d2d4509c4e9b74`, containing merged PR #23. Compose function: `docker compose -p rikskollen-staging --env-file deploy/staging.env -f compose.staging.yml`. Pre-check showed 78 GB available on a 150 GB filesystem. Running API/web/scheduler image tags remained `0152fe1d0f2b7d662df2f08349eccec001adbaef`; this script-only update did not rebuild or recreate them. Those tags are recorded observations, not separately measured application image IDs.

| Evidence | Recorded value |
| --- | --- |
| Bundle | `backups/20261009T084632Z` |
| Backup metadata creation time | `2026-10-09T08:46:42Z` (10:46:42 Stockholm); metadata time is not an exact measured dump snapshot time |
| Initial restore report time | `2026-10-09T08:47:01Z` (10:47:01 Stockholm) |
| Database and restore image ID | `sha256:d8a40176c29aa0c7a20a19f85ddddc47f72d8d6789a7a86a21f3713e71fb4ad6` |
| Dump tool | PostgreSQL 18.6, Debian `18.6-1.pgdg13+2` |
| Archive SHA-256 | `922814ee6750eb5c498b47487d4069b30628b94400481c6f03e15cdc552841de` |
| Timed repeat | Same bundle restored successfully; real 7.634 seconds, user 0.214 seconds, sys 0.235 seconds |

The report queried the restored migration journal (eight rows), the `trigger`/`unchanged` columns and retained table counts. The zero-row operational-column query is a schema check using `LIMIT 0`, not evidence of empty history. Restored snapshot queries showed source URLs, hashes, IDs and completion timestamps for member, vote, catalog and decision imports.

| Restored table | Retained rows |
| --- | ---: |
| `drizzle.__drizzle_migrations` | 8 |
| `decision_documents` / `decision_import_runs` | 41 each |
| `decision_points` | 381 |
| `import_attempts` | 60 |
| `import_runs` | 2 |
| `persons` | 351 |
| `report_catalog_entries` | 948 |
| `report_catalog_pages` | 48 |
| `report_catalog_runs` | 2 |
| `vote_choices` | 835,506 |
| `vote_events` | 2,394 |
| `vote_import_runs` | 3 |

These are retained database rows, including historical versions, not current public coverage. Each of the three completed vote runs reports 798 events and 278,502 choices; their totals reconcile with 2,394 events and 835,506 retained choices. The two catalog versions each report 474 expected entries and 24 pages, matching 948 retained entries and 48 pages. The latest vote snapshot `6a9bfc8f-31c7-4215-b00a-fcb7025dbe68` retains source hash `423f8282a7f1c44710ea17ad29c6744a84810654421c6c6c4c0db89a6d9c5445` and completion time `2026-10-09T07:49:02.090Z`. TU8 snapshot `2260059e-9652-4fcf-9146-d72d90ec3f03` retains its previously verified source hash and October 8 completion time. The report does not establish exact byte-for-byte equality of every restored row with a separately captured source snapshot.

After the initial verification, `docker ps -a --filter name=rikskollen-restore-` and `docker volume ls --filter name=rikskollen-restore-` returned headers only. `dc ps` showed API, web and DB healthy, with the scheduler still running and original service ages preserved. This confirms cleanup and service continuity at that observation. The later timed repeat printed “Isolated restore passed”; independent resource lists were not supplied again after the repeat. The initial restore's elapsed duration and archive size were not captured. The measured 7.634 seconds is the isolated repeat's restore/check/cleanup duration, not an application recovery time objective.

PR #23 CI passed Verify, Frontend E2E and Staging stack for head `dc787b7f5e198f797826f938e3e9bbe20623870b`. The staging log recorded a successful fixture restore, the expected deliberate SQL assertion error, and checksum rejection of a corrupted archive. These are distinct from the host's successful real-data restore; the host did not induce failure scenarios.

The verified bundle remains on the source host. A protected off-host copy and restore from that copy are still NOT RUN. No backup schedule, automatic pruning, role/grant recovery, application connection switch or disaster-recovery SLA is accepted by this record. The M4.3 singular report wording issue remains open in its protocol.
