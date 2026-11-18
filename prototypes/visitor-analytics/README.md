# Offline collection-contract prototype

First small step after PR #36. No dependencies, server, network calls, storage or application integration. `/api/usage` is a proposed URL in the returned test envelope; no such endpoint is registered by this prototype. Nothing runs on visitors' pages.

Run from the repository root with the supported Node runtime:

```sh
node --test prototypes/visitor-analytics/collection.test.mjs
```

## What this proves

- The request body contains only a fixed page category and `external` or `direct-or-unknown` source class. All external domains are collapsed in this first prototype; no hostname allowlist has been approved.
- Member/vote/report IDs, query/campaign values, fragments, titles and full referrers are absent from the constructed request envelope.
- The proposed transport omits credentials and the browser Referer header. These are request options checked offline, not proof of real browser behavior.
- DNT/GPC and excluded routes produce no envelope.
- A simulated collector boundary rejects wrong/missing Origin, extra fields, malformed JSON, arbitrary category/source values and bodies larger than 512 UTF-8 bytes. It reconstructs the accepted object from allowed fields.
- Synthetic A/B member views plus an about view count as two member-detail views and one about view, without retaining which members were viewed.

Five focused Node tests passed on November 18, 2026. No application/database/browser regression suite was rerun: production code is untouched. The prototype is deliberately outside application imports and package build scripts.

## Pinned CE source inspection: partial

The upstream `v3.2.1` tag resolved to `e4f5a87a5570bd61605217e7ceb376636db8eddb` during this inspection. No upstream code was installed or executed.

- [ExternalController](https://github.com/plausible/analytics/blob/v3.2.1/lib/plausible_web/controllers/api/external_controller.ex) constructs an ingestion request, builds/buffers events and can return 202. A 202 alone does not prove a stored event: the handler also uses it for some dropped events.
- [Ingestion.Event](https://github.com/plausible/analytics/blob/v3.2.1/lib/plausible/ingestion/event.ex) includes geolocation, User-Agent processing, salts, user ID and session registration. Its code maps browser/OS/device attributes into session data. Category-only URLs do not remove those backend-derived dimensions.

These observations are partial source review, not a completed privacy audit. No full URL, IP, User-Agent or identity is forwarded to Plausible by this offline prototype. It does not implement the vendor adapter, headers, deduplication, rate limits or collector logging.

## Next small step

Inspect pinned event/session schemas and available expiry mechanisms before installing a disposable CE stack. The operator-selected **90-day retention** must cover associated event/session data, copies and restore behavior. No retention mechanism is implemented or claimed here. If a substantial fork would be required, reconsider the candidate before adding infrastructure.

Actual browser header/body capture, Angular hydration/navigation deduplication, proxy identity, backend-derived fields, public-dashboard API exposure, daily identifier/session semantics, expiry/restore tests and production rollout all remain NOT RUN. See [the evaluation](../../docs/visitor-analytics-evaluation.md).
