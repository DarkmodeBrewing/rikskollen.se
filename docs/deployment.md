# M4.0 staging deployment

Scope: one staging host, manual imports, existing HTTPS reverse proxy. This runbook prepares a deployment test; it does not assert that a host has passed it. Record results in the [small acceptance protocol](m4.0-test-protocol.md) before the next implementation phase.

## Stack and prerequisites

- Linux host with Docker Engine and Compose v2 supporting `up --wait`, enough space for the build/images and PostgreSQL volume, Git; Node 24 runs in a disposable container for the smoke script. Record host architecture and Docker/Compose versions in the protocol. CI tests the native amd64 stack; the target host's build must be checked separately, including ARM if applicable.
- A checked-out commit with both Verify and Staging stack CI green. Builds use Node 24 (at least 24.15.0), pnpm 9.0.0 and the frozen lockfile. Base images track Node 24/PostgreSQL 18 tags; record resulting image IDs as well as the commit because rebuilding later can pull changed base images.
- A staging hostname and HTTPS route managed by your existing reverse proxy. Restrict staging access to testers there. The stack publishes only `127.0.0.1:4080`; API and PostgreSQL have no host ports. A container-based or remote proxy needs an explicitly configured route to the staging host rather than its own loopback address.

The root `docker-compose.yml` remains the development database only. Use `compose.staging.yml` independently with its own project name and persistent volume. API and web images run as the Node user; migration and worker images have runtime dependencies and compiled code, without requiring pnpm or TypeScript on the host. The migration image includes the committed SQL/journal files. Import jobs are explicit one-off commands, never started by the ordinary application startup.

## First startup

Run from the repository root on the staging host. Use a dedicated project and database, with no production data or credentials.

```bash
cp deploy/staging.env.example deploy/staging.env
chmod 600 deploy/staging.env
```

Set `POSTGRES_PASSWORD` in that file to a random hex value (for example generated with `openssl rand -hex 32`). Hex avoids URL-encoding ambiguity in `DATABASE_URL`. `WEB_PORT` defaults to 4080. The file is excluded from Git and the build context. Keep the password stable for an existing volume: changing this environment value alone does not rotate a PostgreSQL user's password.

```bash
export GIT_SHA=$(git rev-parse HEAD)
export IMAGE_TAG=$GIT_SHA
dc() { docker compose -p rikskollen-staging --env-file deploy/staging.env -f compose.staging.yml "$@"; }
dc config --quiet
dc build api web worker migrate
dc up -d --wait db
dc run --rm migrate
dc run --rm migrate
dc up -d --wait api web
dc ps
node scripts/smoke-deployment.mjs --empty
```

Run commands in order and stop on any failure. The second migration invocation checks that an already applied journal is safe to replay. API readiness requires the database and latest schema; it does not require imported data. `/health` on the web server checks the web process → internal API `/ready` → migrated database path. The API's own `/health` remains process-only. The proxy bounds requests and returns a generic 502 if the API is unavailable; readiness returns 503. No credentials or upstream error stacks are returned to the browser by these handlers.

For a proxy on the same host, forward the hostname to the loopback web port. The accepted deployment uses Cloudflare → tunnel → darkmode02/Caddy → WireGuard → darkmode01, so Caddy must reach the web port over WireGuard. Keep API/PostgreSQL internal. Use a host-specific Compose override binding the web port to the host’s WireGuard address, with network access limited to the proxy; never point the remote proxy at its own loopback. Record the actual bind address and port in acceptance evidence. Then run:

```bash
STAGING_BASE_URL=https://your-staging-hostname node scripts/smoke-deployment.mjs --empty
```

Use the real hostname. The smoke script checks health, same-origin API responses, validation errors, SSR headings, attribution and the browser bundle. It does not execute browser JavaScript or establish hydration, mobile or keyboard acceptance; those are manual protocol checks.

## Manual real-data imports

Once the empty-stack checks pass, use the same `dc` shell function and image tag:

```bash
dc run --rm worker dist/sync-persons.js
dc run --rm worker dist/sync-votes.js
dc run --rm worker dist/sync-report-catalog.js
dc run --rm worker dist/sync-decisions.js HD01TU8
dc run --rm worker dist/sync-catalog-decisions.js 3
node scripts/smoke-deployment.mjs
```

This first test imports the complete bounded 2025/26 vote archive and decided-report catalog, but only TU8 plus up to three missing report statuses. Partial status coverage is expected and must stay visible. Record job exit status, completed run IDs, import times, source hashes and reconciled counts. The source samples in methodology are examples, not fixed assertions against a newer archive. Source throttling/outages or changed shapes may block a job; record the failure and retry the same bounded job once the cause is addressed. Do not increase a batch to hide an error. A completed old snapshot stays visible; `sync-decisions.js ID` explicitly refreshes a corrected report, while the batch commands skip completed reports.

If exact vote replay is needed, mount a privately retained official ZIP read-only and pass its path as the second argument to `dist/sync-votes.js`. The service stores hashes/provenance, not raw source archives. No live-source jobs run in CI.

## Recovery checks and subsequent deployments

To check API failure handling, record the current completed run IDs, stop only the staging API and inspect the web health/API responses. Restore it before continuing:

```bash
dc stop api
curl -i http://127.0.0.1:4080/health
curl -i http://127.0.0.1:4080/api/votes
dc up -d --wait api web
node scripts/smoke-deployment.mjs
```

Expect health 503 and proxy 502 while the API is stopped, then successful recovery. To check an import failure without changing the real source, run `dc run --rm -e RIKSDAG_API_URL=http://127.0.0.1:65534 worker dist/sync-persons.js`; expect a nonzero exit and unchanged last completed member run. Then verify persisted real data after stopping API/web, restarting `db` and running `dc up -d --wait db api web`. Keep the volume; never use `down -v` on this staging dataset as a restart test.

Before a later migration, take and protect a database backup. Keep the previously accepted image tags/IDs. Application rollback is only safe against a compatible schema; this slice provides no automated schema downgrade or backup/restore guarantee. Scheduled imports, correction windows, alerting, backup/restore acceptance and public-release review remain following M4 work.

Useful diagnostics: `dc ps`, `dc logs --tail=100 api web`, individual job logs, `docker image inspect` for revision labels and image IDs. Do not attach credentials or raw personal-data dumps to acceptance evidence. CI's stack is disposable and uses a distinct project name; only CI removes its own test volume.

Implementation references: [Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/), [one-off profile services](https://docs.docker.com/compose/how-tos/profiles/) and [pnpm deployment packaging](https://pnpm.io/cli/deploy). The repository pins pnpm 9.0.0; runtime packaging is verified by the container workflow rather than assuming current pnpm documentation applies unchanged to that version.

## Smoke checks without host Node

The accepted darkmode01 deployment intentionally has no host Node runtime. Run the existing script in disposable Node 24 containers, from the repository root:

```bash
docker run --rm --network host -e STAGING_BASE_URL=http://127.0.0.1:4080 -v "$PWD/scripts:/scripts:ro" node:24 node /scripts/smoke-deployment.mjs --empty
docker run --rm -e STAGING_BASE_URL=https://rikskollen.se -v "$PWD/scripts:/scripts:ro" node:24 node /scripts/smoke-deployment.mjs
```

The loopback URL above is for the default binding. Set it to the actual reachable WireGuard address and port for a remote-proxy override (the acceptance failure check observed port 8092). Use `--empty` only before imports. These commands replace each host `node scripts/smoke-deployment.mjs` invocation above; HTTPS checks use the actual hostname. They do not replace manual browser acceptance.

## Angular 22 host validation

Before deploying the issue #4 upgrade, set `NG_ALLOWED_HOSTS` in `deploy/staging.env` to the exact hostname(s) used for SSR requests, without scheme or port. Compose defaults to `localhost,127.0.0.1,rikskollen.se`. Add the actual WireGuard IP if direct smoke requests use it. The standalone SSR server defaults to local hostnames. Do not use a wildcard. The API proxy/health handlers retain their existing behavior; SSR page requests with unlisted hosts return 400.

The reverse proxy should preserve the intended public Host. Angular ignores untrusted proxy headers by default. Only opt into specific `NG_TRUST_PROXY_HEADERS` (for example `x-forwarded-proto`) if the proxy overwrites those headers and the web endpoint is limited to that proxy; no blanket trust is enabled by this upgrade.

This framework/Node/configuration change needs the affected HTTPS, direct-link/hydration, container routing and recovery checks rerun on the host after deployment. The M4.0 protocol remains the historical acceptance of its recorded commit.
