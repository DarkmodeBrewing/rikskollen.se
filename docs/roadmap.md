# Roadmap

Status as of 2026-10-05. This is an ordered proposal, not a delivery schedule. Each milestone must leave a demonstrable, source-linked result.

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

M0–M3 implementation is merged through PR #10. Mapping and PostgreSQL integration tests pass in CI. Official source samples and worked examples are documented in [methodology](data-methodology.md). M4.0 deployed real-data acceptance is recorded in the test protocol. The catalog contains 474 reports; acceptance imported status details for four, leaving 470 pending. Rankings, inferred attendance and member participation rates are outside the delivered scope.

## M4.0 — first staging deployment (accepted)

Prepare API and Angular SSR runtime images, a compiled migration job, explicit manual worker jobs, a persistent isolated PostgreSQL volume and a loopback web endpoint for the existing reverse proxy. Test the container stack in CI with no live Riksdag requests. Follow the [staging runbook](deployment.md) on the target host and record the [small acceptance protocol](m4.0-test-protocol.md), including real imports, HTTPS, source-linked navigation, counts and recovery.

**Gate:** after M4.0 implementation, every mandatory protocol row must be PASS with evidence for the tested commit before beginning another feature or M4 implementation slice. CI success alone does not pass the host protocol. Remediation within M4.0 can continue until the gate passes; a blocker is recorded as FAIL/BLOCKED, never silently waived.

## Following M4 slices

| Slice | Focus | Acceptance |
| --- | --- | --- |
| **M4.1 — frontend E2E baseline** | TypeScript Playwright tests with deterministic mocked API responses, including SSR and hydration | Main journeys and failure/coverage states pass in CI; isolated fixtures, desktop/mobile coverage and actionable traces; no live-source dependency |
| **M4.2 — frontend design and features** | Dedicated design/usability work, consistent page states and a bounded set of discovery/navigation improvements | Reviewed desktop/mobile design, keyboard usability, agreed feature behaviour and source/coverage wording; M4.1 tests remain green and expand for changed journeys |
| **M4.3 — scheduled imports** | Bounded correction window, explicit failed-job reporting and visible last-successful freshness | Cadence and acceptable lag selected using measured source behaviour; failures preserve completed data |
| **M4.4 — operational recovery** | Monitoring/alerts and backup/restore acceptance; source provenance and retention | Restore and alert scenarios verified with recorded evidence |
| **M4.5 — public release** | Accessibility, attribution, personal-data handling and operational readiness | Release checks completed; member photos require a separate rights review |

The [frontend slice plan](frontend-plan.md) defines M4.1/M4.2 scope and test cases. M4.0 host acceptance passed on 2026-10-05. M4.1 is implemented on this branch; the following slices remain planned. Mocked browser tests complement the real-data deployment protocol and PostgreSQL tests.

The Angular upgrade and remaining member-template conversion to signals stay separately tracked in [issue #4](https://github.com/DarkmodeBrewing/rikskollen.se/issues/4). Historical backfill, wider parliamentary activity and member participation metrics require their own validated scope and denominators.

M4.1 commands, coverage and known page-state limitations are recorded in [the E2E runbook](e2e.md). Framework upgrade/signal conversion remains separate from this baseline.
