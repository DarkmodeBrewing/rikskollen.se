# M4.1 frontend regression baseline

M4.0 staging acceptance passed on 2026-10-05. This slice adds TypeScript Playwright tests for the built Angular SSR application; it does not change the deployed application or implement the design/framework upgrade.

## Run from a fresh checkout

Use Node 24 (at least 24.15.0) and the repository's pnpm 9.0.0. Angular 22 also supports Node 22 from 22.22.3:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

`test:e2e` type-checks fixtures/config/tests, builds Angular SSR, then runs Chromium desktop and Pixel 7 viewport projects. No manually started server, database, credentials or Riksdag access is required. After a successful build, `pnpm test:e2e:built` avoids rebuilding. `pnpm exec playwright show-report` opens the HTML report. CI uploads reports, screenshots, traces and per-test SSR logs; no retries hide failures.

## Isolation and coverage

Every test starts a local fixture HTTP API and an SSR process with `API_BASE_URL` pointing at that API. Browser same-origin proxy requests and SSR fetches use the same scenario. OS-allocated ports, new browser contexts and per-test scenario state isolate parallel workers. Processes and sockets are closed during teardown. Unknown API paths and browser requests outside the test origin fail the test; there is no live fallback. API DTOs are synthetic and checked against current frontend contracts, with fixed IDs, timestamps, denominators and source URLs.

Tests cover search/query-preserving member pagination and keyboard submission; profile/source links; history denominator, missing records, unexpected choices, active filter, paging/back/forward/refresh; vote-to-report navigation and exact fixture links; acclamation and unavailable local context; catalog coverage, other/unknown methods; direct deep-link HTML before JavaScript and navigation preserving the browser document after hydration; empty/unimported/missing/outage states; delayed browser response and refresh recovery. Every journey runs at both viewports. This is a focused keyboard/viewport baseline, not a complete accessibility audit.

SSR checks inspect raw HTML containing fixture data. The hydration test follows RouterLink navigation with a marker that would disappear on a document reload. Unexpected page/console errors fail; HTTP resource diagnostics are permitted only for deliberate 404/503 scenarios. Source URLs are checked as attributes, not fetched.

## Current UI limits and next design slice

Issue #4 now distinguishes member-list/profile loading and error states, a missing member profile, and failed versus absent member-import status. Member-list route changes recover after a failed request. The second M4.2 slice extends explicit request states to vote/report routes; import-status failures differ from no completed import. Member vote-history failure handling still uses its earlier unavailable-state text. Recovery currently uses refresh; no retry control is invented by this baseline. Firefox/WebKit and deeper accessibility review remain pre-public-release work. Mocked success cannot establish backend correctness, live-source coverage, data freshness or operational recovery.

Acceptance evidence: frontend CI must pass both viewport projects; Verify and Staging stack remain independent checks. A temporary fixture/link mutation must make the relevant assertion fail before this baseline is accepted. Record the CI result and mutation evidence in the PR. Do not change the M4.0 host protocol to imply a new deployment.

## Local verification (2026-10-05)

- Fixture/config TypeScript check, full workspace build and pnpm 9 frozen-lockfile validation passed. Existing local tests passed (14); nine database integration tests skipped because no local DATABASE_URL is configured.
- All 22 tests passed locally using a temporary Chromium 153 executable obtained from `@sparticuz/chromium@153.0.0`, after the standard Playwright browser download returned truncated archives in this workspace. The temporary launch configuration is not part of the repository; CI uses Playwright's pinned browser and remains unverified until publication.
- Mutation check: temporarily changed the catalog's `totalPoints` fixture from 5 to 6. The SSR test failed on its expected `Av 5 beslutspunkter` assertion. Restored the fixture before the passing suite.

These results establish the local regression baseline; they do not replace the forthcoming GitHub CI run or the host deployment protocol.

## M4.2 vote/report regression update

Vote/report list/detail routes now distinguish loading, unavailable imports, missing records and API errors. Readable topic and exact result-chart checks extend the desktop/mobile suite to 36 cases. Fixture topics remain synthetic and include missing-context fallback. Browser tests do not establish production title coverage; the API integration test and source-linked methodology verify enrichment separately. See [design review](m4.2-vote-report-review.md).

## Page metadata regression update

The suite now has 40 cases across desktop/mobile. `metadata.spec.ts` checks raw SSR titles/social metadata on every page type, static branding assets, client navigation updates, canonical/share URLs and unavailable-page indexing behaviour. The 1200×630 image is a shared brand card; page-specific text is carried in metadata. Social platforms themselves are not called by the tests.
