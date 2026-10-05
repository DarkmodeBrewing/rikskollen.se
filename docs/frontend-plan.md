# Frontend testing and design slices

Status: M4.0 accepted on 2026-10-05. M4.1 is merged; M4.2 remains planned. See [E2E commands and evidence boundaries](e2e.md).

## M4.1 — Playwright E2E baseline

Add Playwright tests in TypeScript against the built Angular SSR application, with synthetic API DTO fixtures matching the current service contracts. Use a local fixture HTTP API via `API_BASE_URL` so the SSR process and browser's same-origin API proxy see the same scenario. Browser route interception alone does not replace the application's server-side fetches; use it only where a test deliberately targets browser-side behaviour. Keep the existing real API/PostgreSQL and staging-container checks.

Fixtures must be isolated between tests/workers and deterministic: fixed source IDs, dates, import times, count denominators and URLs. Unexpected API requests fail the test instead of falling through to a live service. Do not commit raw personal-data dumps or require the Riksdag service, production credentials or a real database. Retain source-shaped synthetic examples for voted and acclamation points, unavailable context and unexpected choice values.

| Journey / state | Required assertions |
| --- | --- |
| Member discovery | Search submits the query; pagination preserves it; profile IDs and source links match fixtures |
| Member vote history | Counts sum to the full row denominator; choice filter and paging update the list/URL without changing summary scope; back/forward restores the filter |
| Vote → decision trail | Document/point/vote matches produce local links; unavailable matches keep source links; acclamation does not invent a vote |
| Catalog and decision summary | Imported/missing report coverage and point denominators agree with fixtures; other/unknown values remain visible |
| Page states | Empty data, missing detail, unavailable import, delayed response and API errors remain distinguishable; recovery/retry behaviour is asserted where supported |
| SSR and hydration | Direct deep links have meaningful HTML before JavaScript; hydrated navigation and refresh work; unexpected console/page errors fail tests |
| Responsive and keyboard use | Core journeys work at desktop and narrow mobile viewports using labels/roles; keyboard focus and active filter state remain usable |

Use role/label locators and web-first assertions; avoid CSS-layout selectors and fixed sleeps. Start with Chromium desktop/mobile projects in PR CI. Add Firefox/WebKit coverage for core journeys before public release. Save a failure trace, screenshot and HTML report as CI artifacts. A fresh checkout must have a documented install/run command and run without a manually started server. Retries may produce diagnostics but must not conceal recurrent failures.

Acceptance: the cases above pass against fixtures in CI, SSR/hydration checks both execute, and a deliberately broken mocked response or link makes the relevant test fail. Mocked E2E success does not establish source freshness or real backend correctness. Selected visual baselines may be added after M4.2's design is agreed; avoid freezing every current layout before redesign.

References: [Playwright API mocking](https://playwright.dev/docs/mock), [test isolation and resilient assertions](https://playwright.dev/docs/best-practices), [web server lifecycle](https://playwright.dev/docs/test-webserver).

## M4.2 — frontend design and features

Give design its own reviewable slice after the E2E baseline. Review the actual staging journeys first, then agree a small feature shortlist and record expected URL, filtering and count behaviour before coding. The design review should cover member discovery/profile, vote list/detail/history and report list/detail at desktop and mobile sizes.

Deliver consistent typography, spacing, navigation, list/detail hierarchy and explicit loading/empty/error states. Make source links, freshness and coverage easy to find and place denominator/exclusion text next to the relevant count. Preserve Swedish source terminology and vote-specific absence wording. Keep keyboard focus, contrast, readable long proposal text and touch targets in the design acceptance.

Feature candidates are improved vote/report discovery (search, filters or sorting) and URL-preserved filters with clear reset/navigation controls. Select a bounded subset from staging feedback rather than adding all candidates automatically. Any supporting read-API change must define which records match and how the matching list total differs from a full summary denominator. Additional sessions, ingestion changes, scores and inferred attendance are separately scoped.

Acceptance: reviewed before/after desktop/mobile views; chosen features have explicit behaviour and meaningful Playwright coverage; SSR, browser navigation and source/count semantics remain correct; keyboard/manual review and CI pass. Update the frontend acceptance record for the changed journeys.

[Issue #4](https://github.com/DarkmodeBrewing/rikskollen.se/issues/4) is implemented in a separate technical slice before M4.2: Angular 22.2.1, signal-based member list/profile state and explicit member request states. The E2E baseline validates the upgrade; visual design remains separately scoped. See [upgrade notes](angular-upgrade.md).

### M4.2 first agreed slice — members

The member directory/profile spacing and vote-choice chart are implemented on `m4/design-members`. Search/paging/filter URL behaviour and full-summary counts remain unchanged. See [design review and before/after evidence](m4.2-design-review.md). This first slice awaits visual approval and CI; vote/report design and their remaining page-state work are separate follow-up slices.
