# Roadmap

## Release direction (2026-10-13): finish v1.0, then maintenance mode

**Decision:** Complete a bounded **Rikskollen v1.0** release in 2026, then freeze feature development and prioritize Gremlin. Revisit product expansion as **v2.0 in 2027 or later**; no v2.0 work is committed or scheduled. Existing M0–M4 history and acceptance evidence remain authoritative. This release plan supersedes the previous post-M4 R0.1–R0.5+ sequence as an *immediate delivery plan*; those ideas are candidates for v2.0, not v1.0 blockers.

### v1.0 release gates (all required)

1. **Finish and verify existing Riksdagen synchronization:** complete bounded decided-report status backfill, reconcile catalog/vote/member counts and missing or unavailable source records, verify scheduled imports and correction windows on the host. Scope is the **existing imported datasets and 2025/26 session**, not every Riksdagen endpoint or all historical sessions. Preserve source identifiers, provenance, import timestamps and visible coverage.
2. **Useful, factual statistics:** publish a small set of aggregate voting/decision measures supported by imported records, with period, denominator, exclusions, source links and methodology. Avoid opaque grades, unsupported attendance claims, political rankings or inferred motives.
3. **Understandable homepage and navigation:** clearly explain what Rikskollen covers, make member/vote/matter discovery obvious, display real recent records and a few understandable statistics, and verify desktop/mobile and keyboard journeys. Do not block release on a full-text search engine or calendar.
4. **Transparency and data status:** complete `/om`, `/datastatus`, source/methodology/privacy explanations, AI-assisted development disclosure, coverage gaps and freshness indicators. Preserve correct metadata, canonical URLs, sitemap and attribution.
5. **Public, anonymous website analytics:** choose and document a minimal privacy-preserving analytics deployment (evaluate Plausible/Umami), with no cookies, persistent visitor identifiers or political-interest profiles. Expose an **open aggregate visitor/usage dashboard** (visits, page views, popular pages, trends and available referrers), document what is collected and retained, and validate privacy and public access. Parliamentary statistics and visitor statistics must be clearly distinguished.
6. **Production acceptance:** CI and Playwright regression tests, deployed source-backed checks, monitoring and failure/recovery alerts, off-host backup and tested restore, accessibility/mobile review, personal-data/photograph rights review, SEO/indexing checks, and a short operational handover. Record PASS/BLOCKED evidence; do not silently waive unresolved gates.

### After v1.0

**Maintenance mode:** keep the site and existing import scheduler operating. Only fix broken imports, security issues, data integrity problems and essential operational failures. Do not start new product features by default. Record known limitations, recovery/deployment steps and future ideas in the handover.

**v2.0 (2027+, explicitly deferred):** additional sessions/history; calendar and Atom/watch feeds; motions, speeches, questions and broader activity; deeper voting analysis and relationship views; Valmyndigheten, SCB and other external sources; broader search and public API commitments. These are *candidates*, not promises. Reassess scope and maintenance cost when the project resumes.

---

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

The [frontend slice plan](frontend-plan.md) defines M4.1/M4.2 scope and test cases. M4.0 host acceptance passed on 2026-10-05. M4.1 and the Angular signals upgrade are merged. M4.2 design and page identity/sharing are merged through PR #17; deployed sharing verification remains separate. M4.3 begins with the worker-to-UI import status slice. Mocked browser tests complement the real-data deployment protocol and PostgreSQL tests.

[Issue #4](https://github.com/DarkmodeBrewing/rikskollen.se/issues/4) upgrades Angular to 22.2.1 and converts the remaining member templates to signals in a separate technical slice before M4.2; see [upgrade notes](angular-upgrade.md). Historical backfill, wider parliamentary activity and member participation metrics require their own validated scope and denominators.

M4.1 commands, coverage and known page-state limitations are recorded in [the E2E runbook](e2e.md). Framework upgrade/signal conversion remains separate from this baseline.

## M4.3 first slice — import status

PR #18 merged the `m4/import-status` slice, which adds durable attempts for all six worker commands, source-scoped published counts and freshness, a read-only status API, and the Swedish `/datastatus` page. See [count definitions](import-status.md) and [functional host acceptance on 2026-10-08](m4.3-test-protocol.md). The next slice adds [opt-in scheduled imports and bounded corrections](scheduled-imports.md); host acceptance and a measured freshness SLA remain open; no live source imports or deployments are part of implementation verification.

## Product direction after M4

M4.3 scheduled-import host observations are recorded in the [test protocol](m4.3-test-protocol.md), with correction selection and other unperformed checks still explicit. M4.4 starts with [database backup and isolated restore verification](backup-restore.md); monitoring/alerts, off-host durability and measured recovery/retention targets remain following work. The M4.3 report singular wording defect remains tracked rather than being silently marked fixed.

The next M4.4 implementation slice adds [opt-in monitoring and webhook failure/recovery alerts](monitoring-alerts.md). Local fixtures do not establish live delivery or outage detection; off-host backups and independent monitor coverage remain open acceptance items.

The [structured source-availability slice](source-availability.md) distinguishes checked reports with unavailable points from execution failures, preserves incomplete coverage, and adds bounded rechecks and public source-gap information. Migration, database/browser CI and deployed acceptance remain separate gates. CU21 import/API verification is recorded in the monitoring runbook; webhook delivery, source-gap host acceptance, the plain-text entity defect and report singular wording remain open.

The M0–M4 milestones above remain the authoritative delivery history and public-release gate. The following sequence captures the product direction agreed on 2026-10-06 without weakening the existing evidence, accessibility, privacy or operational requirements.

Rikskollen should make Swedish parliamentary activity understandable, traceable and easy to follow. It should present public political activity and source-backed derived facts without profiling visitors or assigning politicians opaque grades.

> **Rikskollen granskar makten, inte besökaren.**

Two rules apply across the roadmap:

1. Every displayed fact should be traceable to its source.
2. Every derived measure should have a documented method, denominator, period and exclusions, with underlying records inspectable where practical.

### R0.1 — Understand: public-ready information architecture

Complete M4 first, then make the existing product understandable to a visitor arriving without prior context.

- Rework global navigation around user concepts rather than implementation slices: matters/reports, votes, members, parties, statistics and search. Add calendar/watch destinations only when implemented.
- Redesign the front page so statistics are not the entry point. Lead with **På gång**, **Just nu**, **Senaste besluten** and **Utforska**; derived insights can follow.
- Make search first-class and progressively support human names, topics, constituencies, document IDs and other canonical identifiers without hiding source terminology.
- Add `/om` as a transparency page covering independence, datasets and authoritative sources, imported versus derived data, provenance/freshness, calculation methodology, technology, repository/license/contribution links, privacy, error reporting and disclaimers.
- Explicitly disclose AI-assisted/agentic coding as part of the development methodology. AI tooling is not an authoritative political-data source; source records and deterministic/inspectable transformations remain distinct.
- Add global footer links to `/om`, source/data status, repository and privacy/visitor-statistics information.
- Preserve and extend the existing page metadata, canonical URL, Open Graph, sitemap and source-backed human-readable title work.
- Evaluate self-hosted Plausible versus Umami. Prefer the option that provides useful aggregate analytics with no cookies, no persistent visitor profile and no cross-site tracking. If practical, expose the aggregate analytics dashboard publicly and document the exact configuration rather than merely claiming “privacy-friendly analytics”.

**Acceptance direction:** a first-time visitor can understand what Rikskollen is, discover current material, reach authoritative sources/methodology, and navigate core areas on desktop/mobile. Analytics must not create a durable political-interest profile of visitors.

### R0.2 — Follow: calendar and anonymous subscriptions

Use the Riksdag's authoritative calendar/open-data sources to make Rikskollen temporal: what happened, what is happening and what will happen.

- Import future parliamentary events into canonical event records with source URL, source identifier, retrieval time and correction/update handling.
- Add `/kalender` with useful views such as today, this week and upcoming, plus source-backed event categories and filters.
- Link calendar events to existing matters/reports, documents, committees and later resulting decisions/votes when source identifiers support the relationship. Do not infer relationships from loose text similarity.
- Feed **På gång** on the front page from the same canonical event data.
- Add Atom feeds before collecting subscriber identity. Start with broad Rikskollen/calendar feeds and add entity/topic feeds where matching semantics are documented.
- Evolve Atom into `/bevaka`: follow a matter, member, committee or documented topic without requiring an account.

Email notifications are deliberately deferred until Atom usage demonstrates demand. If introduced, use a dedicated transactional email provider behind an application abstraction and durable idempotent notification outbox; do not operate a general-purpose mail server as part of Rikskollen. Cloudflare Email Service is a candidate, not an architectural dependency.

### R0.3 — Analyse: transparent derived statistics

Build useful analysis from already imported parliamentary data before expanding aggressively into external datasets.

Candidate measures include:

- party voting agreement and change over time;
- party cohesion on recorded votes;
- individual deviations from the participating party majority, presented descriptively rather than as a loyalty/rebellion grade;
- recorded-vote participation with explicit denominator, assignment/time context and the existing warning that “Frånvarande” in a vote is not a general attendance claim;
- member activity using separately sourced motions, questions/interpellations, speeches and committee assignments where coverage is sufficient;
- relationship/network views derived from documented voting agreement.

Do not introduce “best/worst MP”, political recommendations, opaque composite scores or claims about intent. Rankings that implicitly turn measurements into political grades remain outside scope. Every measure needs methodology and drill-down to the observations behind it.

### R0.4 — Connect: external datasource architecture and Valmyndigheten

Before source #2, generalize provenance enough that Rikskollen can distinguish authority, retrieval, normalization and derivation across providers.

Conceptually:

    authoritative source
            |
            v
    bounded/raw ingestion
            |
            v
    canonical Rikskollen entities
            |
            v
    derived observations/aggregates
            |
            v
    API and public UI

Valmyndigheten is the preferred first external datasource because election results and electoral geography naturally connect to parties, constituencies and representation.

Potential outputs include election history, constituency pages, geographic party-support context, MP/constituency relationships and maps. Cross-source joins must document identifier/geography mappings and historical-boundary limitations.

The used electoral roll (röstlängd) is **not** part of this automated importer. Individual election participation may be obtainable as a public record, but acquisition can require requests to municipalities. Treat any such material as a separately sourced/manual dataset with its own publication and personal-data review.

### R0.5+ — Expand selectively

Add external sources only to answer a defined public question.

Candidates:

- selected SCB tables for population, age, income, employment, education and geography;
- government budget/appropriation data linked to propositions, committees and decisions;
- EU legislative context where identifiers and provenance permit reliable joins;
- political-financing and transparency datasets when structured authoritative data is available;
- wider parliamentary history, speeches, motions, questions/interpellations and committee activity already identified in the product brief.

Do **not** mirror all of SCB or other authorities “just in case”. Import bounded datasets with known semantics, update behaviour and a planned public use.

## Explicitly parked

These ideas are useful but are not current delivery work:

- user accounts;
- browser push notifications;
- email watches before Atom proves demand;
- long-lived visitor identifiers or behavioural profiles;
- broad/full SCB mirroring;
- manually requested electoral-roll enrichment until there is a specific editorial use and personal-data review;
- a graph database unless measured PostgreSQL workloads demonstrate a real need;
- public API stability guarantees until the internal canonical model has settled.

## Relationship to existing documents

- [product.md](product.md) remains authoritative for editorial boundaries: evidence over grading, no inferred intent, no unqualified attendance claims and no political recommendations.
- [data-methodology.md](data-methodology.md) remains authoritative for implemented source definitions and calculation semantics. New derived measures and sources must extend it before publication.
- [frontend-plan.md](frontend-plan.md) and [e2e.md](e2e.md) remain authoritative for the delivered M4 frontend/test baseline; the R0.1 information-architecture work should extend those regression journeys rather than replace them.
- [import-status.md](import-status.md) remains the current M4.3 contract. Calendar/external-source import health should later use the same principle of source-scoped, explicit coverage rather than pretending to measure all parliamentary activity.
- [page-metadata.md](page-metadata.md) remains the baseline for page identity and sharing; homepage/navigation changes must preserve its canonical/share semantics.

This post-M4 roadmap is intentionally ordered by product leverage: make the existing data understandable, make it timely/followable, derive transparent analysis, then add external datasets.
