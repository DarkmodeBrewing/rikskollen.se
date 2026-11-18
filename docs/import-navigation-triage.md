# Import, navigation and transparency correction slices — 2026-11-18

These slices precede the next production release. No deployment, source import, host configuration change or production database write is authorized by implementation alone.

## 1. Votation title/date investigation

**Confirmed cause for the three undated archive events:** the archive is a thinner source than `/votering/{id}/json`. It contains `dokvotering.votering[]` with `datum: null` and no title. The richer response contains `votering.dokument` with an exact `sourceid`, session, designation, point, title and date. There is no nested document to extract from an archive row. This is not evidence of missing upstream title/date data.

Inspected read-only on November 18: the latest production vote snapshot has exactly three null dates and null committee-report IDs. All three matched the following richer source records:

| Vote ID | Detail source date | Source designation |
| --- | --- | --- |
| [80c0be09-4795-45d8-a51e-5ca1f8d751da](https://data.riksdagen.se/votering/80c0be09-4795-45d8-a51e-5ca1f8d751da/json) | 2026-03-11 | 0311-1 |
| [e8fb66ff-62fc-4999-9745-fdb0009adcd5](https://data.riksdagen.se/votering/e8fb66ff-62fc-4999-9745-fdb0009adcd5/json) | 2026-06-04 | 0604-1 |
| [ca4ce393-fb64-4b3f-b78c-f77a6ad02228](https://data.riksdagen.se/votering/ca4ce393-fb64-4b3f-b78c-f77a6ad02228/json) | 2025-10-21 | 1021-1 |

Event-only detail responses and an archive-event projection are retained under `apps/worker/src/clients/fixtures/vote-*`. The manifest records observation date, source archive URL and hashes. No actual person/choice rows are committed. Regression tests combine real event fields with synthetic 349-row choices. The previous description of these as ceremonial records was unsupported and is withdrawn.

### Correction contract

- Keep original archive `vote_date`, file and hash unchanged. Add nullable `detail_title`, `detail_date`, URL, response hash and retrieval time via additive migration 0009.
- During a vote import/check, fetch details sequentially only for records without a date or verified committee-report ID. At most 20 candidates; a larger set fails for review. Each request has a 30-second limit and 256 KiB streamed response bound.
- Require matching vote UUID, session, designation and proposal point, vote document type, a nonempty title and valid midnight ISO date. Identity errors, conflicting dates, malformed responses and fetch failures fail the attempt; no guessed metadata or partial completed snapshot is published.
- Unchanged detection compares archive-file hashes AND detail-response hashes. A metadata correction publishes a new full version; previous completed versions remain intact. A successful unchanged check does not relabel the previous retrieval/publication time.
- Reads never fetch upstream. Titles prefer exact vote metadata, then matched point/report context. Display/order uses archive date, falling back to verified detail date; unknown dates sort last. Member-history unknown-date counts use the same fallback. Counts of votes/choices and committee-report linkage are unchanged.
- The detail document IDs are vote documents, not verified committee-report IDs. Do not store them as `document_id` or manufacture local report trails.

### HTML entities

The previously deployed correction already decodes proposal HTML once during ingestion, with named, numeric and double-encoding regression coverage. CU21 was replayed and checked successfully on November 15. Do not decode again in Angular. Other affected stored reports, if identified, need a reviewed bounded replay; unchanged-source checks intentionally retain previous stored text. No mass rewrite is included here.

## 2. Scroll behavior

New list/detail links and pagination start at the top. Browser Back and Forward restore each history entry's stored position. URL fragments continue to scroll/focus their target, including direct fragment reloads. No browser storage or visitor identifier is introduced.

Angular's immediate restoration can clamp a position to a short loading shell. The navigation scroller waits for application stability and the next browser frame before applying the router's saved position. New navigations invalidate older pending restoration; wheel/touch interaction cancels it. Initial fragment loads prioritize the explicit anchor. See [Angular scrolling options](https://angular.dev/api/router/InMemoryScrollingOptions).

## 3. Licence and privacy

The operator chose AGPL-3.0 on November 18. `LICENSE` contains the official version-3 text; this project uses `AGPL-3.0-only`, without the optional “or later” grant. The footer's repository link and `/om` provide source access. Third-party licences and Riksdag data terms remain separate. Privacy evidence, proposed retention/access policy and unresolved account-level checks are in [privacy operations](privacy-operations.md).

## Release acceptance (not performed by implementation)

1. Review CI/database, browser and source-fixture evidence; approve merge and release separately.
2. Preserve dm01's modified Compose bind/untracked copy. Update its Git remote to DarkmodeTools as part of the approved rollout. Back up and verify isolated restore; retain rollback images.
3. Apply additive migration 0009 before starting matching API/web/worker images. The new readiness check requires the column. Old application images can use the additive schema; leave the added columns intact on rollback.
4. An approved vote archive check/reimport is needed to publish metadata for existing events. The next scheduled check will also detect absent detail hashes and publish a new version. Do not restart the updated scheduler before approving that data write. Reconcile 798 events/278,502 choices against the actually fetched source; if newer source totals differ, investigate rather than force these historical numbers.
5. Verify all three exact IDs, source titles/dates and detail provenance over HTTPS. Compare list, detail and member history; source null dates stay available, unknown report linkage remains unknown, no count changes are implied by metadata.
6. Verify homepage/legacy directory links and DarkmodeTools links from merged #33/#34, desktop/mobile scroll/Back/Forward/fragment behavior, healthy Datastatus and scheduler.
7. Verify API logs omit request paths/search/IP/header values. Review Cloudflare and shared proxy settings before claiming privacy acceptance. Do not remove old logs or alter shared host logging without separate approval.

Production acceptance remains NOT RUN. Privacy account-level verification is an explicit release blocker until evidence is supplied; implementing these slices does not certify v1.0.
