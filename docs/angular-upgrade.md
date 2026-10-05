# Issue #4 — Angular upgrade and signal-based member pages

Implementation: Angular framework, compiler, CLI, build and SSR packages are pinned together at **22.2.1**, the npm `latest` stable release checked on 2026-10-05. The webapp uses TypeScript **6.0.3**; backend/root TypeScript remains 5.9.3. RxJS remains 7.8.2. Supported Node versions follow Angular's package engines: `^22.22.3 || ^24.15.0 || >=26.0.0`; CI and runtime/build images use Node 24. pnpm stays 9.0.0.

References: [Angular compatibility](https://angular.dev/reference/versions), [signals/RxJS interop](https://angular.dev/ecosystem/rxjs-interop), [SSR host validation](https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf).

## Migration and behavior

The updater stalled while fetching dependency metadata. Packages were upgraded together, then the installed CLI's core/CLI migrations were run explicitly from 21.0.1 to 22.2.1. SSR reports no migration collection. Core migrations explicitly preserve eager change detection for existing components, the pre-22 hydration mode through `withNoIncrementalHydration`, and the previous extended-diagnostic settings. The two converted member pages use OnPush because their template state now comes from signals. Broader design and change-detection changes remain separately scoped.

Member list/profile templates no longer import AsyncPipe or use `| async`. Route observables keep RxJS switchMap cancellation and expose state with toSignal. List query/page and profile ID streams suppress unchanged values. Errors are caught inside individual requests, so one failed request does not terminate subsequent route updates. The member list and import status distinguish loading, completed/empty and error states; member profiles distinguish loading, source 404 and API failure. Profile history filters do not trigger a redundant profile reload. Source terminology, coverage and full vote-history denominators remain unchanged.

The historical generated App unit test asserted an Angular starter heading. It now checks the actual navigation and independent source attribution and supplies a router provider. The frontend workflow runs these unit tests as well as Playwright.

## SSR configuration required on deployment

Angular 22 validates hosts. Standalone SSR defaults to `localhost,127.0.0.1`. Set `NG_ALLOWED_HOSTS` to a comma-separated list of actual request hostnames/IPs, without scheme or port; Compose defaults to local hosts plus `rikskollen.se`. Add the WireGuard IP if direct smoke requests use it. Unlisted SSR hosts return 400. No wildcard or blanket proxy-header trust is configured. See [deployment instructions](deployment.md) before deploying changed images.

CI tests the new Node 24 container stack. The deployed host must rerun affected HTTPS, SSR deep-link/hydration, routing and recovery checks after applying this framework/Node/configuration change; the prior M4.0 acceptance remains tied to its historical commit. No live import or host deployment is part of issue #4.

## Verification

Local fixture/config TypeScript checking and the full workspace build passed. Existing tests passed (14); nine database integration tests skipped locally without DATABASE_URL. Angular unit tests passed (2). All 30 desktop/mobile Playwright cases passed using the temporary Chromium 153 executable described in the E2E runbook. The expanded suite asserts member loading, missing versus error, import-status errors, recovery after a failed page, and permitted versus unlisted SSR hosts. pnpm 9 frozen-lockfile validation passed. GitHub CI uses the pinned Playwright browser and PostgreSQL; its result must be checked before review acceptance.
