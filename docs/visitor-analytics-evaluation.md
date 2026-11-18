# Visitor analytics evaluation and proposed first slice

Status: **evaluation complete; Plausible CE is the preferred prototype candidate, not an approved installation.** Reviewed November 18, 2026, against deployed main `f4bbd2a`. No analytics collector, browser script, infrastructure service, public dashboard or account has been installed or enabled by this evaluation. No purchase or production change is included.

## Required outcome

Meet roadmap gate 5 with a public aggregate visitor dashboard: estimated visits, pageviews, popular page categories, trends and available coarse referrers. Explain the definitions and limitations separately from parliamentary statistics and Cloudflare's existing records. No cookies, persistent visitor identifiers, specific political-interest histories, search text, replay or account identification. This is not a legal-compliance certification.

## Comparison based on primary sources

| Concern | Plausible | Umami | Rikskollen assessment |
| --- | --- | --- | --- |
| Identification | Documents a website-specific hash of IP/User-Agent with a daily salt, not raw IP/UA storage [P1] | Current docs describe a monthly rotating salt by default; self-hosting supports `SALT_ROTATION=day` [U1, U2] | Cookieless is not identifier-free. Temporary pseudonymous processing must be disclosed and verified against the pinned release. |
| Individual activity | Aggregate dashboard is the documented focus [P1] | Includes session/visitor activity profiles [U3] | Plausible is the closer product fit; Umami would need stronger restrictions, even with daily rotation. |
| Public access | Website visibility supports a public dashboard [P2] | Public Share URLs allow selecting visible views [U4] | Verify actual unauthenticated API/UI exposure, not just a screenshot. Never share session or realtime visitor views. |
| URL privacy | Custom pageview URLs supported; default campaign/referral query handling retains some parameters [P3, P4] | Supports exclude-search/hash and before-send controls [U5] | Defaults are insufficient. Build an allowlist before transmission and enforce it at the collector. |
| Self-hosting | CE reference stack includes PostgreSQL and ClickHouse; upstream recommends at least 2 GB RAM and compatible CPU instructions [P5, P6] | Supports PostgreSQL and Docker installation [U6] | Umami has a simpler database footprint. Plausible adds ClickHouse operations, backup and upgrade work. |
| Cloud/CE parity | CE is a separate long-term release with fewer features than Cloud [P7] | Current docs cover evolving features; release-specific verification is required | Do not copy current Cloud snippets into an older CE release and assume compatibility. |
| Retention | No deployment-specific expiry mechanism has been demonstrated | Salt rotation is not deletion [U1] | Neither candidate passes retention acceptance merely by rotating identifiers. Test actual expiry and backup handling. |

**Recommendation:** prototype self-hosted Plausible Community Edition first, with page-category-only events and explicit retention enforcement. Its daily identifier model and aggregate presentation are closer to the bounded purpose. The operating cost is the extra ClickHouse service; reconsider Umami with daily salt rotation and aggregate-only sharing if CE retention/integration requires a substantial fork. Do not maintain a large analytics fork to pass this gate.

The current upstream CE reference points to `v3.2.1` [P5, P6]. Treat that as the initial version to inspect, not proof of security currency or compatibility. Pin image digests and record exact tracker/backend versions after a release/security review. Live host resource headroom was inspected read-only and is sufficient to justify a resource-limited prototype; no load or coexistence guarantee was established. Detailed host capacity is not part of this public proposal.

## Proposed collection contract

### Page categories

| Browser route | Allowed analytics path | Public label |
| --- | --- | --- |
| `/` | `/` | Start |
| `/ledamoter` | `/ledamoter` | Ledamotslista |
| `/ledamot/<id>` | `/ledamot` | Ledamotsprofil |
| `/voteringar` | `/voteringar` | Voteringslista |
| `/votering/<id>` | `/votering` | Voteringsdetalj |
| `/arenden` | `/arenden` | Ärendelista |
| `/arende/<id>` | `/arende` | Ärendedetalj |
| `/datastatus` | `/datastatus` | Datastatus |
| `/om` | `/om` | Om Rikskollen |
| Unknown, admin, API, analytics routes | no event | Excluded |

Do not send source IDs, document/page titles, names, political topics, query strings (including campaign parameters), fragments, custom properties or click text. Page categories deliberately prevent “most-read politician/report” analytics. Public label must be “Mest besökta sidtyper”, not a claim about individual political interests.

Use explicit pageview events from successful Angular navigation, once for initial hydration and once per new pathname/history entry. Do not count fragment-only, filter or pagination-only query changes as a new pageview. Two different detail pathnames can each count a view of their common category, without retaining their IDs. No server-render event: it would double count hydration and mix crawlers with browser measurements. JavaScript-disabled visitors and blocked/failed collectors are absent from these statistics; this is a measured subset, not all traffic or verified people.

Referrer: proposal is a small approved hostname-to-source label allowlist, otherwise “Övrig extern” or “Direkt/okänd”. Never transmit full referrer paths, queries, arbitrary hostnames, internal paths or campaign fields. Only evaluate the initial external referrer; do not turn in-site navigation into referral data. Without sufficient source information, report unknown rather than invent attribution. Allowlist contents remain a product decision for the prototype.

### Transport and server boundary

Prepare a disabled-by-default integration. Browser sends only an allowlisted category/source label to a narrow same-origin collector using a constant request URL, `referrerPolicy: no-referrer` and `credentials: omit`. Do not rely on cleaning the JSON body while the browser Referer header still carries the original query or detail path. The server validates a small fixed schema/body limit and expected Origin, rejects unknown fields and constructs the vendor event from allowed constants. Forwarded vendor referrers must be reconstructed from the approved source map, never copied from arbitrary input. Standard tracker auto-capture must remain off: backend query stripping happens too late to prove sensitive values never crossed the network. Do not import a script that independently sends full URLs, document titles, engagement or automatic outbound events.

A collector using Plausible's Events API must follow its User-Agent and forwarded-IP semantics [P8] if claiming visitor estimates. IP/User-Agent are still processed transiently even when not stored as analytics fields. Accept forwarding headers only from the verified proxy chain; never trust arbitrary client-supplied values. If the implementation uses a fixed proxy identity instead, it must not claim accurate visitor/visit counts. Do not add a durable custom visitor ID to solve counting problems.

Suppress full Referer, Cookie, Authorization and raw request/body logging at this boundary. Apply bounded request rates/body sizes without creating a new durable per-person database. A request can still be processed by Cloudflare and the delivery chain; this proposal cannot disable or erase those existing records.

Do not collect replay, scroll depth, engagement timers, errors, performance, goals, journeys, distinct IDs, device properties supplied by the app or custom events. Verify any backend-derived geo/device dimensions and disable unnecessary ones where supported; if the pinned release cannot meet the chosen minimization policy without major patching, record that tradeoff before acceptance. No marketing claim about anonymity substitutes for inspecting stored data.

## Proposed operations and configuration

- Separate Compose project and analytics data volumes/database credentials. Never give the analytics service access to Rikskollen's parliamentary tables or existing database role. Internal database ports; no incidental change to the running app Compose project.
- Resource limits, health checks, bounded size-based diagnostics and a verified time-based retention mechanism. Self-hosted does not mean maintenance-free.
- `BASE_URL` points at a chosen analytics origin; generate `SECRET_KEY_BASE` privately at installation. Disable public registration after owner provisioning. Keep administration authenticated and private; expose only the explicitly reviewed aggregate dashboard. Do not assume generic environment names for retention or registration exist in CE—confirm supported settings in the pinned source.
- Reporting timezone: Europe/Stockholm. Store operational/event timestamps consistently and test DST/day boundaries for visitor counts. Explain that daily identifier rotation and local reporting days may differ.
- Operator-selected policy (November 18): 90 rolling days of category-level analytics, including associated event/session records. Implementation and expiry enforcement remain subject to prototype verification. No indefinite data archive. The mechanism must cover every relevant event/session table, derived copy/export and backup. Rotate or exclude analytics backups consistently; do not restore expired records into public service. Identifier salt rotation is not retention enforcement. Do not publish the target as an observed guarantee before expiry/restore tests pass.
- Public dashboard: visits, pageviews, page-category breakdown, trends, approved coarse referrer labels; no public raw event/session lists or arbitrary drill-down exposing hidden data. If stock public views reveal extra dimensions, use a fixed aggregate projection instead and reconsider the maintenance cost before building it. No tracking of the dashboard's own visitors in this first slice.
- Honour browser Do Not Track and Global Privacy Control as an explicit project preference; no new local-storage opt-out identifier. Collector failure or a disabled flag must never block navigation or emit repeated retries.
- `/om` and footer link to the public aggregate view only after an approved deployment and unauthenticated acceptance. Until then keep the existing truthful “not installed” copy. Cloudflare disclosure remains separate.

## Synthetic worked example and metric boundaries

Three browser pageviews: member profile A, member profile B and `/om?q=private#integritet`. The collector receives only `/ledamot`, `/ledamot` and `/om`, with an approved source label or unknown. The public pageview result is three; page categories are Ledamotsprofil = two, Om = one. No member ID, search text or fragment appears in the outbound body or stored rows.

If the first two events share a temporary backend daily identifier, the vendor may count one visitor estimate for them. That is not evidence of one human, one person across days, or a durable audience size. Never sum daily uniques and label the result unique monthly people; use the pinned product's documented metric and disclose its limitations. Visits require the pinned backend's actual session boundary to be documented and tested before a public number is named “besök”. Synthetic data demonstrates the contract, not a live analytics result.

## Prioritized implementation and acceptance

| Step | Status now | Required evidence |
| --- | --- | --- |
| Product/privacy comparison | PASS, documentation | Primary-source comparison above; provisional CE preference |
| Exact CE tracker/ingestion/schema inspection | NOT RUN | Pin backend + script/digests; inspect transient identifiers, stored dimensions, field validation, proxy identity and APIs |
| Isolated synthetic prototype | NOT RUN | No live traffic or production credentials; route/referrer allowlist proof, body/header capture, unknown field/oversize/rate handling |
| Identifier/session/public-view test | NOT RUN | Same-day versus next-day behavior; verify salt destruction boundaries and no cross-day linkage; anonymous dashboard access and forbidden API endpoints |
| Expiry/backup/restore | BLOCKED pending mechanism | Seed expired fixtures, run proposed cleanup twice, prove deletion across data copies; restore excludes expired data; no production deletion |
| Angular SSR/hydration/navigation | NOT RUN | One event per intended view; none for queries/fragments/SSR or analytics pages; DNT/GPC; no cookies/storage; fail-open browsing |
| Browser/privacy and security review | NOT RUN | No sensitive value crosses network in test traces; no raw sensitive logs; no analytics dependency telemetry; no unsupported compliance claims |
| Rollout and public dashboard | NOT RUN, approval required | Resource/coexistence check, private owner setup, backup/rollback, public access without account, live test event provenance, updated `/om` |

Next authorized development step after this proposal: inspect the pinned CE source and build a local/disposable synthetic prototype. Do not enable production collection just to obtain demonstration data. Stop and reconsider the candidate if retention, public-view exposure or session semantics require a substantial fork. No calendar/new parliamentary datasets or broader product analytics are included.

## Source register (checked November 18)

- P1: [Plausible data policy](https://plausible.io/data-policy) — identifier and default collection model; provider statement, not proof of CE runtime behavior.
- P2: [Plausible public visibility](https://plausible.io/docs/visibility).
- P3: [Plausible custom locations](https://plausible.io/docs/custom-locations) — manual location overrides; current Cloud snippets must be checked for CE parity.
- P4: [Plausible query parameters](https://plausible.io/docs/custom-query-params).
- P5: [CE reference repository](https://github.com/plausible/community-edition/tree/v3.2.1) — prerequisites/version.
- P6: [CE versioned Compose](https://github.com/plausible/community-edition/blob/v3.2.1/compose.yml) — reference service topology.
- P7: [Cloud versus CE](https://plausible.io/self-hosted-web-analytics).
- P8: [Plausible Events API](https://plausible.io/docs/events-api) — event fields and forwarding semantics; verify pinned CE compatibility.
- U1: [Umami metric definitions](https://docs.umami.is/docs/metric-definitions).
- U2: [Umami environment variables](https://docs.umami.is/docs/environment-variables).
- U3: [Umami sessions](https://docs.umami.is/docs/sessions).
- U4: [Umami public share views](https://docs.umami.is/docs/enable-share-url).
- U5: [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration).
- U6: [Umami installation](https://docs.umami.is/docs/install).
