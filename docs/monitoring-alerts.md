# M4.4 — operational monitoring and webhook alerts

This slice adds an opt-in read-only monitor and generic JSON webhook notifications. It uses `/health` and `/api/data-status`; it never imports source records or connects directly to PostgreSQL. It is separate from the scheduler and from [backup/restore acceptance](backup-restore.md). Backups, disk capacity, TLS certificate expiry and off-host durability are not monitored by this implementation.

## Signals and operating thresholds

The monitor polls every five minutes by default. Each HTTP request has a ten-second timeout, redirects are rejected, and status responses are bounded at 1 MiB. Invalid/malformed timestamps, stale status responses (over two minutes old), future timestamps beyond five minutes and duplicate latest jobs are treated as endpoint failure. Configure accurate host clocks.

| Signal | Default incident condition |
| --- | --- |
| Health/status endpoint | Non-success HTTP, timeout, invalid/stale response |
| Expected import jobs | No attempt recorded in the supported scope, or latest attempt failed |
| Running import | No final outcome after 45 minutes |
| Daily jobs | Successful check older than 26 hours |
| Missing-report batch | Successful check older than three hours |
| Published members/votes/catalog | Missing or incomplete snapshot |

Expected jobs are persons, 2025/26 votes, report catalog, catalog decisions and refresh decisions. Manual parent attempts also count, matching scheduler due-time semantics. Individual child decision/vote-linked attempts are not separately tracked; a scheduled batch failure is represented by its parent. The API provides the latest attempt per job, so brief failures that finish and recover between polls can be missed. Wrong-session latest attempts are treated as absent expected checks; this first monitor is scoped to 2025/26.

Successful unchanged checks advance operational freshness even when publication timestamps stay old. Zero-work correction or missing-report passes count as successful checks. Partial decision coverage during backfill is expected and does not itself raise an incident. Starting a retry does not resolve an existing failed-job incident; a successful finished check is required. If the endpoint cannot be evaluated, previous job/coverage incidents remain unresolved.

Thresholds are initial operator choices with allowance for the scheduler's tick/pass/retry delays, not a Riksdag freshness SLA. Measure lag before adopting service targets. The monitor requires scheduled imports to be intentionally enabled; enabling it on an empty or deliberately unscheduled installation will report missing/overdue jobs.

## Delivery and persisted state

A failure notification is emitted when an incident key first becomes active; a recovery notification is emitted when that key clears. Continued failures, changed failure reasons and new failed attempts under the same active key do not generate repeated messages. There are no periodic reminders. A single payload may contain several transitions.

```json
{
  "event": "rikskollen-monitor",
  "deliveryId": "opaque-stable-id",
  "events": [
    { "key": "job:votes", "reason": "Latest import attempt failed", "attemptId": "attempt-id", "outcome": "failure" }
  ]
}
```

The receiver must accept this generic schema and acknowledge with HTTP 2xx. Slack/Discord/email APIs may need a receiver adapter; no provider-specific compatibility is claimed. `Idempotency-Key` equals `deliveryId`. The monitor persists a pending payload before POST and retries with the same ID after delivery failure/restart. A receiver should deduplicate that ID: network failure after acceptance can cause repeated delivery. This is at-least-once delivery, not an exactly-once guarantee. Pending delivery is retried before new observation; a prolonged receiver outage delays new checks and yields `monitor-error` logs. Recovery transitions are evaluated after pending delivery succeeds.

State is saved atomically with restrictive file permissions on the `monitor_state` volume. Loss/reset of this state can resend active incidents or lose an unacknowledged recovery. Do not clear it to silence an alert. Concurrent commands sharing state are rejected by a directory lock. Normal exits release it; a forced kill/host crash can leave `state.json.lock`. Stop all monitor processes and verify no writer is active before removing that exact lock. Invalid state is rejected rather than silently reset. No automatic stale-lock takeover is performed.

The webhook URL is secret configuration, excluded from log/state output. HTTP(S) URLs must contain no embedded credentials, query or fragment; use a secret path on a trusted HTTPS receiver. Compose environment visibility is still privileged host access. Redirects are disabled to avoid forwarding notification data elsewhere. Payloads contain incident keys/reasons and attempt IDs, not source rows, credentials or upstream exception stacks. Without a webhook URL, transitions are emitted to structured logs and counted as delivered: this is logs-only mode, not remote notification acceptance.

## Deployment

The `monitoring` profile is disabled by ordinary stack startup. Build the updated worker image with the tested revision and retain existing import-monitor state. No database migration is added. Configure `MONITOR_BASE_URL`, `MONITOR_WEBHOOK_URL` and thresholds in the protected deployment environment file. The default `http://web:4000` checks the internal web → API → database path; a public HTTPS base URL additionally tests the external route from this container. `/health` here must be the web health endpoint; the API's process-only `/health` is insufficient.

```bash
export GIT_SHA=$(git rev-parse HEAD)
export IMAGE_TAG=$GIT_SHA
dc build worker monitor
# Configuration only: no checks, state writes or notifications.
dc --profile monitoring run --rm --no-deps monitor dist/monitor.js --check
# One pass uses the persistent monitor state and may send configured alerts.
dc --profile monitoring run --rm --no-deps monitor dist/monitor.js --once
# Enable repetition after inspecting the first pass.
dc --profile monitoring up -d monitor
dc logs --tail=50 monitor
```

Start the application/scheduler separately beforehand. The monitor deliberately has no startup dependency requiring a healthy application, so it can observe application failure. One-shot exit codes: 0 means no active incidents, 1 means incidents present, 2 means configuration/state/lock/delivery failure. The daemon continues polling after failures. Stop with `dc stop monitor`; do not run a one-shot against the same state concurrently with the daemon. Recreate the service after changing environment settings.

A monitor on the application host cannot report its own host outage, total network outage, shutdown or inability to run. A separate external uptime/dead-man check is required for those failures, including missing `monitor-check` output, locked state and receiver outages. No such external service is provisioned here. Notifications are an operator-facing mechanism, not public status text.

## Verification and acceptance

Local implementation verification: eight focused tests passed, worker build/type check and compiled `--check` passed. Tests cover no false incident on unchanged checks/partial backfill, failed retry/recovery, overdue/abandoned/missing jobs, malformed/oversized responses, persistent webhook retries/deduplication, endpoint recovery and corrupted/locked state. A real-socket HTTP receiver test is configured for CI and skipped locally where socket binding is unavailable. No real receiver was contacted during implementation.

| Check | Status | Required evidence |
| --- | --- | --- |
| Local monitor logic and retry fixtures | PASS | Eight tests, build/type check, config-only invocation |
| CI HTTP failure/retry/recovery receiver | NOT RUN yet | Real HTTP fixture receiver accepts stable delivery IDs and recovery |
| Packaged config and volume permissions | CI configured; host NOT RUN | Worker image config check, first persistent-state pass as Node user |
| Host failure and recovery notifications | NOT RUN | Approved receiver, observed payloads and timestamps |
| Host deduplication/restart | NOT RUN | No repeated active incident, reused pending ID after restart |
| External monitor outage detection | NOT RUN | Independent uptime/dead-man observation |
| Thresholds and operating policy | Provisional | Measured lag, receiver availability and agreed response process |

For host acceptance, configure an approved test receiver first. Use a separate state file so the test does not alter daemon incident state. The commands below send real notifications to that configured receiver but neither change production data nor stop imports. The first pass deliberately targets an unreachable loopback port inside its disposable container; the second returns to the configured real base URL.

```bash
# Expected exit 1 and one endpoint failure notification.
dc --profile monitoring run --rm --no-deps \
  -e MONITOR_STATE_FILE=/app/monitor-state/acceptance.json \
  -e MONITOR_BASE_URL=http://127.0.0.1:65534 \
  monitor dist/monitor.js --once
# Expected endpoint recovery notification. Exit 0 if all real checks are healthy.
dc --profile monitoring run --rm --no-deps \
  -e MONITOR_STATE_FILE=/app/monitor-state/acceptance.json \
  monitor dist/monitor.js --once
# Repeating the healthy check should emit no duplicate transitions.
dc --profile monitoring run --rm --no-deps \
  -e MONITOR_STATE_FILE=/app/monitor-state/acceptance.json \
  monitor dist/monitor.js --once
```

If other incidents are raised, inspect their evidence rather than resetting state. Exit 2 means the configuration, state or delivery failed, so it is not a successful notification test. Capture receiver payloads/acknowledgements, delivery IDs and times; verify a retry/restart against the receiver separately. Keep endpoint secrets and source rows out of test records. Record delivery and recovery observations before declaring alerts operational. The M4.3 wording defect, eligible correction rotation and off-host backup checks remain open in their respective records.

### Host observations, 2026-10-09 / 2026-10-11

On `darkmode01`, the packaged `--check` reported tick 300 seconds, daily 26 hours, batch three hours, running 45 minutes and `webhookConfigured:false`. A logs-only pass using `/app/monitor-state/acceptance.json` detected one `job:catalog-decisions` incident and persisted its state. The failure delivery ID was `4b0c6a90da3fab6a6c00b255b134aec69db1bbe6ada21c95f4b986cdc7b7efb3`. The operator repeated the same command on 2026-10-11: it printed only `monitor-check` with `incidents:1`, with no duplicate transition payload. This verifies packaged configuration, writable persisted state and logs-only deduplication across separate containers. Shell exit codes and deployed SHA were not supplied in these outputs.

The detected attempt `a8360a5e-ae74-4917-b12d-4521c374c5a8` was a scheduled catalog batch, failed on 2026-10-09 at 14:04:04.811 UTC after publishing eight of ten planned reports. Logs identified CU21's acclamation/motivation-vote parser rejection and FiU10's missing structured points. The [source-shape review](data-methodology.md#source-shape-review-2026-10-11) distinguishes the parser fix from the unresolved compilation-only source limitation. The incident is valid and must not be cleared by resetting state or declaring missing source points successfully imported.

At that point, actual receiver delivery, failure/retry acknowledgements and recovery remained **NOT RUN**. The persistent catalog incident meant a healthy-endpoint pass could still exit 1; endpoint recovery and job recovery are separate transitions. The later logs-only job recovery below does not establish operational alert-delivery acceptance.

### CU21 host verification, 2026-10-11

The operator rebuilt the worker, stopped the scheduler, imported `HD01CU21` and recreated the scheduler. Import run `293ebc39-50c2-4e1f-8dfe-968c39a383a9` published three points with source hash `8f64c57e74b202f0bc8daa58147ce4c4bff976168c0906e0cb04ce7567d51269`. The public API returned the same run/hash and import time `2026-10-11T18:16:18.309Z`; point 2 retained `acklamation`, vote ID `62fbd172-047f-402b-b878-f5ba1a07005b` and `localVoteAvailable:true`. Point 3 also had a verified local vote link. This passes CU21 import/API verification, not batch recovery or webhook delivery. The deployed SHA was not supplied.

The output exposed a separate plain-text decoding defect: point 1 retained `&ouml;` and `&auml;` entities. Track this alongside the M4.3 singular wording defect; neither is silently marked fixed here. The next [source-availability slice](source-availability.md) changes verified missing points into an explicit source-gap result. A later successful batch can recover its execution alert while source availability remains incomplete; host acceptance of that behavior is still required.

### Source-availability job recovery, 2026-10-11

After deployment of PR #27, the scheduled catalog attempt `bb4dd1d8-477e-465c-9f1b-c6e21a49db8d` succeeded with six published reports and four checked-unavailable reports. The public API retained five current source gaps including the earlier manual FiU10 check. Reusing `/app/monitor-state/acceptance.json` in a disposable monitor container with `MONITOR_WEBHOOK_URL` explicitly blank emitted one `job:catalog-decisions` event with `outcome:recovery`, delivery ID `e5432b69c5e23974e5fac3020cc58d8d55b88f11b821b4eef96c91e56d69a7eb`, and `monitor-check` with `incidents:0`. No state reset was requested in the verification procedure. This passes logs-only execution recovery while source availability remains incomplete.

The recovery event retained reason “Latest import attempt failed” and prior incident attempt ID `0456b9bc-346b-4083-8cfd-a2cad4140bfc`; that ID differs from the initial October 9 incident. Do not infer unobserved intervening transitions. The retained failure wording is a follow-up copy defect, not a failed recovery transition. Repeat-recovery deduplication, actual receiver acknowledgements and external outage detection remain NOT RUN. Full source-gap evidence and remaining host checks are in [source availability acceptance](source-availability.md#ci-and-deployed-acceptance-2026-10-11).
