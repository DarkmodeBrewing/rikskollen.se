#!/usr/bin/env bash
# Consistent custom-format dump using the database container's own pg_dump.
set -euo pipefail
umask 077
if [[ $# -lt 1 ]]; then
  echo 'Usage: bash scripts/backup-db.sh NEW_BUNDLE_DIRECTORY [docker compose global options...]' >&2
  exit 2
fi
bundle=$1
shift
mkdir -m 700 -- "$bundle" # Refuse to overwrite an existing bundle.
complete=false
cleanup() {
  if [[ $complete == false ]]; then
    rm -f -- "$bundle/database.dump.partial" "$bundle/database.dump" "$bundle/SHA256SUMS" "$bundle/metadata.txt"
    rmdir -- "$bundle" || true
  fi
}
trap cleanup EXIT
compose=(docker compose "$@")
"${compose[@]}" exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$bundle/database.dump.partial"
test -s "$bundle/database.dump.partial"
mv -- "$bundle/database.dump.partial" "$bundle/database.dump"
(cd -- "$bundle" && sha256sum database.dump > SHA256SUMS)
{
  printf 'created_at_utc=%s\n' "$(date -u +%FT%TZ)"
  printf 'repository_commit=%s\n' "$(git rev-parse HEAD)"
  printf 'database_image_id=%s\n' "$(docker inspect --format '{{.Image}}' "$("${compose[@]}" ps -q db)")"
  "${compose[@]}" exec -T db pg_dump --version
} > "$bundle/metadata.txt"
complete=true
printf 'Backup complete: %s (restore verification still required)\n' "$bundle"
