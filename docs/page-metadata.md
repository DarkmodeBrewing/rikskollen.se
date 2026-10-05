# Page titles, social sharing and branding

Implemented on `m4/page-titles-branding` after PR #16. Inspection confirmed that the visible vote/report headings already use source-backed context; the HTML document title was still `Webapp`, the document language was English, and the starter favicon remained.

## Result

Every routed page supplies a Swedish browser title and description. Details use the member's name, report title, or exactly matched vote topic from the existing API. A vote with both point heading and report title includes both in its browser/social title. Loading, missing and failed views use a generic branded title rather than stale content from the previous page.

A component-scoped metadata effect runs in Angular SSR and after browser navigation. Open Graph includes title, description, site name, Swedish locale, absolute page URL and image metadata. Twitter uses the large-image card fields with the same source-backed title/description. All pages share a native 1200×630 branded PNG; no party imagery or inferred voting result is added to the image.

The public origin is explicitly `https://rikskollen.se`, independent of the request Host header. Shared URLs retain their filters. Canonical links consolidate filtered member histories to the profile; list pagination retains `page` so subsequent pages remain discoverable. Directory searches and unavailable/error states have `noindex, follow`. This does not change existing HTTP response status handling.

`robots.txt` points to a basic sitemap containing the three main index pages. Detail pages remain discoverable through server-rendered list links and pagination; this static sitemap does not claim to enumerate every imported record. No search-engine submission was performed.

The SVG favicon and multi-size ICO fallback use green `#087963`, cream `#f7f5ef` and amber `#e2a142`. The social image also uses the dark footer green `#132f28`. HTML declares `lang="sv"` and the green theme colour.

## Verification

- Production browser/SSR build passed.
- Six Angular unit tests and all 40 desktop/mobile/browser/SSR cases passed locally using temporary Chromium 153.
- Four focused metadata cases passed again after adding full vote-title context and pagination/search canonical handling.
- Raw SSR HTML checks cover all six route types, titles, language, canonicals and social-image tags without JavaScript.
- Client checks cover navigation updates, absence of duplicate metadata, filtered share URLs, canonical pagination/search handling and noindex error/missing states.
- Static favicon, PNG and sitemap responses passed; PNG was visually reviewed at 1200×630.
- E2E TypeScript and diff checks passed. The temporary browser config is not committed.

GitHub CI, deployed URL/image reachability and actual social-platform preview rendering remain unverified until publication/deployment. No new environment settings, data imports or migrations are required.

Preview: [social card](../apps/webapp/public/social-preview.png).
