# Project brief

## Purpose

Rikskollen makes the Riksdag's public records approachable and traceable. A visitor should be able to find a member, inspect their parliamentary assignments and recorded votes, see what each vote was about, and follow links to the original documents and decisions. The service presents evidence and context; it does not grade politicians, assert intent, or claim that a recorded vote represents every parliamentary decision.

## Audience and questions

- Voters and journalists: “How did this member vote on a specific matter, and what was the proposal?”
- Researchers and developers: “Which underlying records and definitions produced this view?”
- Interested citizens: “What has happened in a particular parliamentary session, and where is the source?”

The initial interface should be in Swedish, with source terminology kept visible. Accessibility, mobile readability and plain-language explanations are part of the product, not a later decoration.

## Initial public experience

1. Search or browse serving members and open a profile with party, constituency, assignment dates and official source links.
2. Browse recorded votes by date/session and open one vote with its proposal point, subject/motive type, individual choices (Ja/Nej/Avstår/Frånvarande), source and related document.
3. From a member profile, filter that member's recorded votes and view the underlying events rather than only a percentage.
4. See coverage, freshness, missing data and the calculation method where any aggregate appears.

Start with a recent, explicitly bounded parliamentary session. Expand history only after reconciliation against the Riksdag's published totals and documented gaps.

## Later opportunities

- Wider decision/document coverage beyond the implemented 2025/26 committee-report trails and decided-report catalog.
- Speeches, motions and committee activity where source coverage supports useful links.
- Carefully defined vote participation summaries and trends with denominators, time ranges and substitute/assignment context.
- Event timelines, including government formation, if an authoritative source and maintainable editorial workflow are specified. A “days without a new government” counter is a possible separate feature, **not** evidence of parliamentary attendance or part of the first data slice.
- Public data exports and a stable read API after the internal model settles.

## Current delivery boundary

M1–M3 implement the member directory, recorded vote/history views, source-linked report trails, a decided-report catalog and summaries scoped to imported points or person rows. The next step is M4.0 staging deployment and its [acceptance protocol](m4.0-test-protocol.md). Manual imports remain separate jobs; deployed data coverage and operational readiness must be verified before the next implementation phase.

## Editorial and technical boundaries

- No “best/worst MP,” loyalty score, political recommendation, or unqualified absence rate.
- Never infer why someone was marked absent; assignments, leave and substitutes require separate verified context.
- Keep raw source references and ingestion timestamps, and make reprocessing possible when upstream data changes.
- Distinguish source facts from Rikskollen's derived fields and explain transformations.
- Show “Källa: Sveriges riksdag” and that Rikskollen is an independent service. Check rights and personal-data obligations before publication.

See [methodology](data-methodology.md) for definitions and [roadmap](roadmap.md) for the delivery sequence.
