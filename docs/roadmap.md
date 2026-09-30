# Roadmap

Status as of 2026-09-30. This is an ordered proposal, not a delivery schedule. Each milestone must leave a demonstrable, source-linked result.

| Milestone | Outcome | Acceptance gate |
| --- | --- | --- |
| **M0 — Reproducible prototype** | Establish a reliable local baseline | Fresh checkout can install, build and run documented smoke checks; fix package boundaries and broken scripts; database migrations and a local stack run repeatably; CI runs those checks. Record known limitations. |
| **M1 — Member directory** | Persist one bounded set of Riksdag members and assignments | Paginated fetch; schema mapping handles observed shapes; idempotent import into Postgres; API and Swedish UI list/detail pages; stable IDs, source links, timestamps and import coverage are visible. |
| **M2 — Recorded votes** | Show who voted what on a vote | Import every page for one named session; store vote events and individual choices separately; link proposal point, matter/document and person; reconcile selected counts with source; UI has vote detail and member vote history. |
| **M3 — Context and careful summaries** | Explain decisions and vote patterns | Document/decision trail includes relevant points and identifies decisions without recorded votes; any aggregate has a published numerator, denominator, period and exclusions; vote absence is not presented as general attendance. |
| **M4 — Public release** | Operate an independent, transparent site | Repeatable deployment, scheduled imports with correction window, monitoring and failure alerts, backups/restore check, accessibility review, source and photo attribution, personal-data review, and visible freshness/coverage status. |
| **Later** | Wider history and richer activity | Backfill and reconcile additional sessions; speeches/motions/committee context and public API only where the evidence and maintenance cost justify them. Government-formation status remains separately scoped. |

## Delivered implementation

| Slice | Implemented result | Evidence boundary |
| --- | --- | --- |
| M0 | Workspace builds, migrations, PostgreSQL tests and CI | Deployment acceptance is separate |
| M1 | Versioned member/assignment imports, directory and source links | Serving-list snapshot; no attendance source |
| M2 | Complete 2025/26 archive import, vote detail and member history | Source vote rows; incomplete IDs/dates stay unknown |
| M3 decision trails | Complete report snapshots; vote links match document, point and vote ID | TU8 source example; other statuses imported in bounded batches |
| M3 catalog | Reconciled decided-report catalog and resumable status imports | Reports not marked decided are outside its denominator |
| M3 summaries | Decision-method counts and member choice counts with filterable history | Imported points/rows, explicit denominators, exclusions and corrections |

M0–M3 implementation is merged through PR #10. Mapping and PostgreSQL integration tests pass in CI. Official source samples and worked examples are documented in [methodology](data-methodology.md). No deployed real-data acceptance is recorded; implemented import support does not mean that a server has ingested the full catalog. Rankings, inferred attendance and member participation rates are outside the delivered scope.

## M4.0 — first staging deployment (current slice)

Prepare API and Angular SSR runtime images, a compiled migration job, explicit manual worker jobs, a persistent isolated PostgreSQL volume and a loopback web endpoint for the existing reverse proxy. Test the container stack in CI with no live Riksdag requests. Follow the [staging runbook](deployment.md) on the target host and record the [small acceptance protocol](m4.0-test-protocol.md), including real imports, HTTPS, source-linked navigation, counts and recovery.

**Gate:** after M4.0 implementation, every mandatory protocol row must be PASS with evidence for the tested commit before beginning another feature or M4 implementation slice. CI success alone does not pass the host protocol. Remediation within M4.0 can continue until the gate passes; a blocker is recorded as FAIL/BLOCKED, never silently waived.

## Following M4 slices

1. Scheduled imports with a bounded correction window, explicit failed-job reporting and visible last-successful freshness. Select cadence and acceptable lag using measured source behaviour.
2. Monitoring/alerts and backup/restore acceptance; retain enough source provenance for corrections and define raw-response retention.
3. Public-release review: accessibility, attribution, personal-data handling and operational readiness. Member photos require a separate rights review.

The Angular upgrade and remaining member-template conversion to signals stay separately tracked in [issue #4](https://github.com/DarkmodeBrewing/rikskollen.se/issues/4). Historical backfill, wider parliamentary activity and member participation metrics require their own validated scope and denominators.
