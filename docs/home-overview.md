# Homepage overview and bounded statistics

Scope: a homepage for discovery of the existing 2025/26 data, its recorded-vote count and source-labeled decision-method counts. No new datasets, analytics, member ratings or participation rates. `/ledamoter` becomes the member directory; old `/?q=...` and `/?page=...` links retain their query parameters and reach the directory. Navigation, sitemap and canonical/search metadata follow the new path.

## Behaviour and evidence

The homepage leads with purpose, the historical period, clear matter/vote/member entry points and a member search. It shows up to three source-dated imported report trails before statistics, source links, period, denominators, exclusions, missing-source gaps and publication times. It explicitly distinguishes this selection from current parliamentary news and vote-specific source records from general attendance.

`/api/overview` performs a repeatable-read read-only transaction. Completed snapshots are session-scoped before version selection; point aggregation occurs only after latest-report/catalog selection. The report feed is limited to three before public serialization. There is no attempt-history enrichment or N+1 source-title lookup. Source/data integrity mismatches fail the request instead of inventing complete figures. No live source fetch or mutation occurs on an API read.

See [formulas and source-linked examples](data-methodology.md#homepage-overview-202526). The integration fixture verifies correction/pending/wrong-session/out-of-catalog exclusion; source-gap overlap; valid-date ordering; missing/invalid dates; vote reconciliation; empty imports; and rejection of incomplete point snapshots.

## Acceptance

Build/type checks, PostgreSQL integration, unit tests and the full desktop/mobile regression suite must pass. New browser cases cover SSR figures and limitations, source/local links, directory search, legacy query links, unknown data, outage/retry and no horizontal overflow. Existing member/vote/report and transparency journeys remain mandatory.

Deployment remains **NOT RUN** for this slice. No migration is added and no VPS service or data is changed during implementation. After review and deployment approval, back up/verify restore, retain accepted images, build matching API/web/worker images and deploy. Verify root and `/ledamoter` SSR/hydration, old query links with JavaScript disabled, keyboard/mobile search, source-linked report cards and formulas against the API/source examples. Measure the new endpoint against host-scale retained history before acceptance. Compare source counts/IDs with Datastatus and `/arenden`; confirm unchanged coverage and scheduler operation. Do not label the new page public-release acceptance or start deferred v2 work.

## Read-only host-data check — 2026-11-17

The exact new read function was executed in a read-only transaction against dm01's existing database, without deploying files, changing services or writing source/application data. It returned in 137 ms: 798/798 voting events, 469/474 reports, 2,415 points = 782 röstning + 1,628 acklamation + 4 other (`okänt`) + 1 empty source value. Five excluded reports and five source gaps were retained as separate measures. The three dated reports were JuU41, JuU48 and SfU37 at source date 2026-08-13. This validates an observed read against host-scale retained data, not deployed API/browser acceptance or a response-time SLA.

Observed catalog snapshot: 4ff83ab1-1ba5-49fa-8364-ea042a70cabf, imported 2026-11-17T18:41:56.761Z. Vote snapshot: 00daa13b-3510-429f-b735-ddded618ad91, published 2026-11-03T08:34:14.252Z. Later successful unchanged checks do not advance that publication time. All figures are examples tied to this observation, not constants shipped in the UI.
