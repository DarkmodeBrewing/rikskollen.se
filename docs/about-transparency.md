# About and transparency vertical slice

Scope: `/om`, core navigation and footer links, static source/method/privacy explanations, page metadata and sitemap. This follows the November 15 accepted readability/query-fix redeployment at `7b5feed`. It does not add analytics, datasets, ingestion or schema changes.

## Public content and decisions

- Operator/contact: DarkmodeTools with GitHub Issues. GitHub Issues was explicitly selected by Lars on November 17; the account was renamed from DarkmodeBrewing to DarkmodeTools on November 18. Issues are public and require a GitHub account; the page asks visitors not to publish sensitive personal details.
- Scope: current imported member roster, recorded votes and decided-report catalog/statuses for 2025/26. No hardcoded live counts; link to Datastatus for changing coverage and freshness.
- Source facts versus derived counts: person-row and imported proposal-point denominators, filter behaviour, unknown/missing records and vote-specific absence wording. Link to the authoritative methodology and worked examples.
- Provenance: IDs, source URLs, hashes and import times; hashes do not archive/reproduce older source responses. Unchanged checks and failed attempts are distinct from publication times.
- AI-assisted development is disclosed; the authoritative parliamentary records remain the source. Technology/source repository and contribution/contact links are included.
- No code licence is invented. The repository has no explicit code licence at this baseline, so the page states that fact and separates source-data reuse terms from code licensing. The operator still needs to choose a code licence if reuse is intended.

## Privacy evidence boundaries

Repository inspection found no application cookies, persistent browser identifiers or analytics integration. The public copy scopes those claims to the application. Tests assert no cookies/storage in the isolated about-page browser session; this is not a production CDN/privacy audit.

The existing deployment documentation identifies Cloudflare and web servers in the delivery chain. The page explains that technical request information can be processed there, and explicitly leaves unverified infrastructure log access/retention open. Do not publish an invented retention period or claim end-to-end anonymity, GDPR compliance or that the whole transparency/privacy release gate has passed.

No public visitor dashboard exists in this slice. The page distinguishes parliamentary counts from visitor statistics and describes analytics as future work. Before enabling analytics, verify the actual configuration/collection/retention and public aggregate access; update this page at that time. Hosting log retention/access and a complete personal-data review remain release decisions.

Riksdag reuse/independence/attribution wording links to the official [usage terms](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anvandarstod/anvandningsvillkor/) checked on November 17. No new member photos are introduced.

## Route and accessibility

The static Angular route is server-rendered and requires no data API call. It remains available during a data API outage. Core/section/footer links use the existing router, with anchor scrolling enabled and native reload scroll restoration retained. Desktop contents navigation becomes a single column on narrow screens. Footer navigation wraps with visible keyboard focus. Metadata follows the existing canonical, Open Graph, social card and robots policy; `/om` is added to the sitemap.

## Verification and deployment acceptance

Run frontend unit tests, `pnpm typecheck:e2e`, the web build and full desktop/mobile Playwright suite. New regression cases cover raw SSR during API outage, no data-API requests, metadata/sitemap, keyboard footer navigation, in-page fragments, direct fragment reload, source/contact links, history/back navigation, empty browser storage and no horizontal overflow. Existing journeys must remain green.

Deployment/host acceptance remains **NOT RUN** for this slice. No VPS changes or migration are part of implementation. After an approved deployment, verify `/om` over public HTTPS before/after hydration and with JavaScript disabled; source/contact links; narrow screen and keyboard use; `/om#integritet` direct/reload navigation; footer links on data and error pages; canonical/social metadata and sitemap. Preserve the previous release/rollback images. Do not enable analytics or change hosting/privacy settings as an incidental deployment step.

### Local verification — 2026-11-17

Web build and E2E TypeScript check: PASS. Frontend unit tests: seven passed. Full Chromium desktop/Pixel 7 suite: 52 passed, including four new about-page cases and a 320-pixel overflow check. Desktop/mobile previews and privacy sections were visually inspected. The API-outage case performed no data-API requests. Hosted/production verification is still NOT RUN.

### GitHub account rename — 2026-11-18

Public operator/profile, repository, Issues and methodology links now use `DarkmodeTools`. The footer, homepage, Datastatus and older roadmap issue links are updated alongside `/om`. The local development remote now points to `https://github.com/DarkmodeTools/rikskollen.se.git`. No account-qualified image registry, workflow or deployment references were found in `.github`, `deploy` or the README. The VPS checkout remote still needs verification during the next approved rollout; this change does not modify the host or deploy the site. Existing code-licence and infrastructure log-retention decisions above remain open.

### Licence/privacy correction — 2026-11-18

The operator selected AGPL-3.0-only. The repository now carries the official licence text and `/om` explains corresponding-source access separately from parliamentary data rights. This supersedes the earlier no-explicit-licence baseline above. Routine API request logging is disabled in the pending implementation and error/request serialization is minimized. [Verified hosting facts and proposed seven-day/access policy](privacy-operations.md) distinguish present size-based limits from unverified provider retention. No hosting setting or production log was changed. Cloudflare/account-level review remains a release gate.
