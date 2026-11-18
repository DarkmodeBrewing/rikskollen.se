# Plausible CE storage/retention inspection

November 18, 2026. Scope: offline source inspection after #37, without running vendor code, containers, databases or analytics collection. No production changes. **A bounded external retention mechanism looks feasible to prototype without a source fork, but 90-day enforcement is NOT VERIFIED.**

## Reproduce

Extract upstream [revision e4f5a87](https://github.com/plausible/analytics/tree/e4f5a87a5570bd61605217e7ceb376636db8eddb) (`v3.2.1`) outside this repository, then run:

```sh
node prototypes/visitor-analytics/inspect-plausible.mjs /path/to/extracted/source
```

The manifest hashes nine inspected files. The audit rejects missing/drifted files and asserts selected static findings. It never executes upstream code or opens a database. The tag/revision is a source-review baseline, not a reviewed production image digest or security-currency guarantee. A schema snapshot does not substitute for inspecting the effective migrated database.

## Findings

1. **Native data is not just anonymous aggregate counters.** [`events_v2`](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/lib/plausible/clickhouse_event_v2.ex) and [`sessions_v2`](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/lib/plausible/clickhouse_session_v2.ex) retain user/session identifiers, paths or entry/exit pages, referrer/campaign fields, geographic and browser/device dimensions. Events copy session attributes. Category-only input prevents storing specific parliamentary entities but does not remove the backend-derived dimensions.
2. **No rolling TTL is present in the checked-in ClickHouse schema snapshot.** [Structure](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/priv/ingest_repo/structure.sql) uses MergeTree events and VersionedCollapsingMergeTree sessions, partitioned by month. Targeted source/config/migration searches did not identify a ready 90-day native-data retention setting. This is not a proof that no external/unsupported mechanism exists.
3. **Native “delete/reset” is not physical expiry.** [`Plausible.Purge`](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/lib/plausible/purge.ex) resets a site's native-statistics visibility timestamp. Imported-data deletion follows a separate path. Neither resetting a dashboard nor selecting a 90-day date range passes physical deletion acceptance.
4. **Daily rotation is not strict midnight unlinking.** [Runtime configuration](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/config/runtime.exs) schedules daily salt rotation. [`Session.Salts`](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/lib/plausible/session/salts.ex) loads current/previous salts and cleans records older than a 48-hour threshold during initialization/rotation. [`Session.CacheStore`](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/lib/plausible/session/cache_store.ex) tries the current and previous derived identity and accepts a cached session with an inactivity gap of up to 30 minutes. This permits continuity across a rotation boundary. Actual lifetime also depends on cache/runtime behavior and is not proven by this source read. Do not copy a Cloud claim of destruction every 24 hours into a CE deployment notice.
5. **Historical copies need inventory.** A [session migration](https://github.com/plausible/analytics/blob/e4f5a87a5570bd61605217e7ceb376636db8eddb/priv/ingest_repo/migrations/20240222082911_sessions_v2_versioned_collapsing_merge_tree.exs) explicitly warns about a leftover backup table. Import tables, migration leftovers, ingestion counters, PostgreSQL salts, diagnostics, exports, inactive parts and backups need separate policies/inventory. Fresh-install and upgrade behavior must both be checked; no such leftover is asserted to exist on a running instance here.

## Retention design to test, not apply

Use a dedicated analytics database/project, a fixed UTC cutoff `now - 90 × 24 hours`, and no imports/exports in the initial slice. Avoid copying parliamentary identifiers. Inventory effective tables and engines after migrations. Refuse to call the audit complete if unknown visitor-bearing tables or copies exist.

A ClickHouse TTL or scoped cleanup job can be configured outside the Plausible application, so a fork is not yet justified. However, [ClickHouse TTL deletion happens during merges](https://clickhouse.com/docs/concepts/features/operations/delete/ttl), not exactly at the expiry instant. A 90-day TTL alone is insufficient for an exact maximum-retention promise. A public query cutoff can prevent expired data being served while cleanup completes, but it cannot be presented as physical erasure.

Session versions contain positive/negative rows for collapsing. Testing must preserve their accounting: expiring versions independently by changing last-activity timestamps can leave unmatched rows. Assess session-start-based expiry for all versions together, and explicitly define counts for sessions straddling the cutoff. No production SQL or destructive cleanup script is provided by this slice.

Restore must remain isolated from ingestion and public access. Prune/check against restore-time UTC, not the backup creation cutoff, before publication. Expired data inside archived backups still exists: enforce backup expiry/exclusion too. Do not claim sanitizing a restored copy erases the original backup. If the exact 90-day physical maximum cannot be enforced, report the actual lag and obtain a policy decision before collection rather than silently relaxing the selected policy.

## Next small runtime experiment

A disposable **ClickHouse-only** fixture is sufficient to test the retention mechanics before running the full CE stack. No live traffic, external ports or production volume/database connection.

| Case | Required observation | Current status |
| --- | --- | --- |
| Old/exact-cutoff/new events | Deterministic UTC boundary, including a DST date | NOT RUN |
| Session positive/negative versions | Counts remain correct after expiry; cutoff-spanning session behavior documented | NOT RUN |
| Repeat cleanup | Idempotent; failure is detected and public access remains gated | NOT RUN |
| TTL without merges / pending mutations | Expired visibility and physical lag measured separately | NOT RUN |
| Backup restored after advancing clock/cutoff | No expired rows published; original backup retention separately checked | NOT RUN |
| Unknown/migration-copy table | Inventory fails closed, rather than ignoring the copy | NOT RUN |

The earlier promise of no cross-day linkage is an unpassed acceptance criterion, not established CE behavior. Resolve that identity-policy mismatch in a separate small test/decision. Retention, public dashboard exposure, exact stored dimensions and browser transport remain unapproved for production. Source inspection narrows the next experiment; it does not certify Plausible as meeting the complete policy.

## Validation in this slice

Pinned nine-file audit: PASS. Missing-source and deliberate source-hash drift rejection: PASS. Existing five offline collection-contract tests: PASS. No vendor runtime, actual deletion, restore, browser or full application suite was run. Production is unchanged.
