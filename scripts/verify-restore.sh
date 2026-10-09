#!/usr/bin/env bash
# Never connects to the application's database or volume.
set -euo pipefail
umask 077
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo 'Usage: bash scripts/verify-restore.sh BUNDLE_DIRECTORY [ASSERTIONS_SQL]' >&2
  exit 2
fi
bundle=$(cd -- "$1" && pwd)
test -s "$bundle/database.dump"
# Compare only the fixed archive filename; never trust paths from a checksum file.
expected=$(cat "$bundle/SHA256SUMS")
actual=$(cd -- "$bundle" && sha256sum database.dump)
[[ $expected == "$actual" ]] || { echo 'Archive checksum mismatch; restore refused.' >&2; exit 1; }
rm -f -- "$bundle/restore-report.txt" "$bundle/restore-report.txt.partial"
name="rikskollen-restore-$(date -u +%Y%m%d%H%M%S)-$$-$RANDOM"
volume="$name-data"
image=${RESTORE_POSTGRES_IMAGE:-postgres:18}
volume_created=false
container_created=false
cleanup() {
  local failed=0
  rm -f -- "$bundle/restore-report.txt.partial" "$bundle/restore-report.txt.complete"
  if [[ $container_created == true ]]; then docker rm -f "$name" >/dev/null || failed=1; fi
  if [[ $volume_created == true ]]; then docker volume rm "$volume" >/dev/null || failed=1; fi
  if [[ $failed != 0 ]]; then echo "Cleanup incomplete: inspect $name and $volume" >&2; return 1; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# No shared network, published port, scheduler, production mount or external source.
docker volume create "$volume" >/dev/null
volume_created=true
# Set ownership before run so even a partially failed startup is cleaned up.
container_created=true
docker run -d --name "$name" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=rikskollen \
  --mount "type=volume,source=$volume,target=/var/lib/postgresql" "$image" >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  # The entrypoint's temporary init server has no TCP listener.
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d rikskollen >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ $ready == true ]] || { echo 'Isolated restore database did not become ready.' >&2; exit 1; }
docker exec -i "$name" pg_restore -U postgres -d rikskollen \
  --exit-on-error --no-owner --no-privileges < "$bundle/database.dump"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
docker exec -i "$name" psql -X -U postgres -d rikskollen -v ON_ERROR_STOP=1 \
  < "$script_dir/verify-restore.sql" > "$bundle/restore-report.txt.partial"
if [[ $# == 2 ]]; then
  docker exec -i "$name" psql -X -U postgres -d rikskollen -v ON_ERROR_STOP=1 \
    < "$2" >> "$bundle/restore-report.txt.partial"
fi
{
  printf 'verified_at_utc=%s\n' "$(date -u +%FT%TZ)"
  printf 'restore_image_id=%s\n' "$(docker inspect --format '{{.Image}}' "$name")"
  cat "$bundle/restore-report.txt.partial"
} > "$bundle/restore-report.txt.complete"
# Remove resources before publishing a success report.
docker rm -f "$name" >/dev/null
container_created=false
docker volume rm "$volume" >/dev/null
volume_created=false
trap - EXIT
mv -- "$bundle/restore-report.txt.complete" "$bundle/restore-report.txt"
rm -- "$bundle/restore-report.txt.partial"
printf 'Isolated restore passed: %s/restore-report.txt\n' "$bundle"
