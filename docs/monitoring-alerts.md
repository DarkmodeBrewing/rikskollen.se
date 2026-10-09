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
