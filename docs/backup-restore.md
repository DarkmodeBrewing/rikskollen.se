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
| PostgreSQL 18 fixture dump/restore | NOT RUN here | Staging stack CI includes fixture provenance/count/history assertions |
| Failure cleanup and corrupted archive rejection | CI configured; host NOT RUN | No disposable container/volume left; corrupt archive rejected |
| Real host backup and isolated restore | NOT RUN | Exact SHA, database/restore image IDs, archive checksum, restore report and elapsed time |
| Off-host copy and restore from copied bundle | NOT RUN | Protected destination, checksum and second restore evidence |
| Application recovery/cutover | NOT RUN | Compatible schema/images, roles, readiness and coverage checks |
| Alerts and measured retention/recovery targets | Following slice | Verified failure/recovery notifications and selected policy |

Implementation and CI configuration are not host acceptance. Record actual output before declaring backups recoverable.
