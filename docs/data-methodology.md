# Data sources and methodology

This document records intended handling rules. It is not a claim that ingestion or public calculations already work.

## Primary sources

| Domain | Riksdag source | Intended use |
| --- | --- | --- |
| Members and assignments | [Ledamöter](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/ledamoter/) | Stable person identifiers, current/historical assignments and terms |
| Recorded votes | [Voteringar](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/voteringar/) | Vote ID, proposal point, member choice and recorded absence |
| Documents and decisions | [Dokument](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/dokument/) | Context for what was proposed and decided |
| Formats and caveats | [API overview](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anvandarstod/om-apiet/), [known deviations](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anvandarstod/avvikelser-i-data/) | Import validation, visible coverage limitations |
| Reuse | [Terms of use](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anvandarstod/anvandningsvillkor/) | Attribution, independence, image rights and personal-data review |

The Riksdag describes voting records from session 1993/94 onward. Availability is not a promise of complete, uniform coverage across all years.

## Meaning of a vote

Riksdag vote data reports “Ja”, “Nej”, “Avstår” or “Frånvarande” for a member in a recorded vote. A committee report can have several proposal points; show all relevant points when explaining the matter's result. The source includes main votes, which may concern the substantive question or the motivation. Many decisions are made by acclamation and do not appear in vote data. Never label a missing vote as an abstention, a vote against, or proof of absence from the chamber. See the Riksdag's [voting guidance](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/voteringar/).

**Attendance wording:** until there is a separate, validated attendance source and denominator, show “Recorded as Frånvarande in this vote” (or the source's Swedish equivalent). A count of such records is a count of **vote events**, not days absent or a measure of overall work. Do not infer illness, leave, pairing, or a substitute's role from the value alone.

## Proposed data pipeline

1. Fetch paginated source data for one bounded session; persist source URL, identifiers, fetched time and a checksum/raw snapshot reference for audit and replay.
2. Validate response shape and preserve unknown or changed source values for review; do not silently coerce malformed data.
3. Upsert idempotently by stable Riksdag identifiers. Model each vote and each member's choice separately, linking vote, proposal point, document and person. Keep source values and normalized display values.
4. Reconcile totals and sample records against the Riksdag's own views/datasets; flag incomplete pages, source changes and known deviations.
5. Serve a read-only API and UI that display source links, coverage range and last successful import.
6. Re-fetch a recent overlap window for corrections; retain enough provenance to explain changes.

Before implementing ratios, define eligible members per event and whether substitutes, leave, role changes and incomplete records are included. Display numerator, denominator, time period and excluded events. No aggregate is published until the definition is documented and verified with examples.

## Publication requirements

Credit “Källa: Sveriges riksdag” and state clearly that Rikskollen is independent. If member photos are used, credit “Foto: Sveriges riksdag” and review applicable rights. Review personal-data processing and the [source terms](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anvandarstod/anvandningsvillkor/) before going live. Link each displayed fact to the most specific available primary record.

## M1 member import (2026-09-29)

The serving list at `personlista/?utformat=json` returned `@hits=349` with 349 records in the observed sample. Page parameters `p` and `sz` did not reduce the response. The importer therefore treats the unfiltered result as a roster of stable `intressent_id` values and fetches separate `parti` batches. It requires each batch's `@hits` to match its record count and reconciles every ID and party before a database transaction. The latest completed run is the sole directory snapshot; old records are hidden from this view. The API shows its completed time, expected/imported/current count and source URL. A missing or changed person is unknown until a subsequent complete run; no attendance inference follows from status or assignments.

The worker maps source person and assignment fields, preserves the source's assignment date strings, and records source URL, retrieval time and SHA-256 of each person JSON object. Nested biography attributes can have an empty `intressent_id`; mapping uses the parent person ID in that case. Attribute values are validated but not published in the M1 directory. The import stores a checksum but not the complete raw JSON; correcting a past run requires re-fetching the source, which may have changed. More durable replay and corrections belong in a later milestone.

## M2 recorded votes (2025/26)

The official session ZIP `votering-202526.json.zip` is the import boundary. In the inspected 2026-09-29 archive there were 798 files, each one main-vote event with 349 member-choice rows, totalling 278,502 choices. The tested `voteringlista` `p`/`sz` page parameters repeated the first rows, so this import uses every file in the official session dataset instead of claiming that list pagination works. A new complete run is published only after every archive file passes validation and all row counts reconcile. Runs are versioned; prior completed runs remain available in storage but only the latest complete run is served. The archive and each file have SHA-256 checksums; the raw archive is not stored by the service.

One `votering_id` identifies an event. `punkt` identifies its proposal point within `beteckning`, and the document ID is derived from the archive filename only where it matches a verifiable committee document (`HD01` followed by a committee code). Three numbered events in the inspected archive have no verified document ID and no `datum`; those links and dates remain unknown. Member choices keep source `intressent_id`, name, party, constituency and exact `rost` value. The IDs can be joined to the member directory where a current profile exists, but historical choices do not require a current member record. A displayed count of `Frånvarande` means that many source rows were marked absent **in that particular recorded vote**. It is not a count of days absent or a measure of overall attendance.

The vote detail links its primary voter record and, where validated, its committee document. The import does not infer the full decision from one main vote: a document can have multiple proposal points and decisions by acclamation do not appear in this vote dataset. UI counts are simple counts of the 349 source choices for the selected event. No percentages, rankings or derived attendance rates are published.

## M3 decision trail: bounded report (2026-09-30)

The first report is `HD01TU8` (`2025/26:TU8`), fetched from [its document status](https://data.riksdagen.se/dokumentstatus/HD01TU8.json). In the inspected response, 15 proposal points are present: five have `beslutstyp=röstning` and a `votering_id`, and ten have `beslutstyp=acklamation` with no vote ID. The document-level `beslutdatumtid` is 2026-02-25. These are source values for this one report, not session totals.

The importer retains all source proposal points, their headings, proposal text converted from presentation HTML to plain text, decision type, winning proposal label where present and exact source vote ID. It records a SHA-256 of the response, the source URL and import time in a versioned single-report snapshot. The raw JSON is not retained; a checksum alone cannot reproduce an old response after the upstream source changes. A transaction publishes only a complete report. The API serves its latest completed version.

An M3 vote link inside Rikskollen requires a match on document ID, proposal point **and** vote ID in the latest completed M2 session snapshot. If the vote dataset is not imported or a record does not match, the source link remains available but no local vote link is asserted. `Acklamation` means the source marks that point as decided by acclamation; a missing vote ID with another decision type remains unknown. The UI does not infer the final wording of a law, a member's intent, general attendance or an aggregate from these values. Other reports are outside the first demonstrated import; no claim of 2025/26 decision coverage is made.

## M3 vote-linked import coverage

The bounded batch's candidate set comes from distinct, non-null committee report IDs in the **latest completed 2025/26 M2 vote snapshot**. The batch validates every candidate ID before fetching, imports at most 25 missing reports per invocation, and stops at the first source/mapping failure. Each successful report is a separate atomic versioned import; rerunning skips completed IDs. The snapshot's source URL and run ID identify the provenance of the candidate set. Report JSON may change between runs, and historical response bytes are not stored.

The `/arenden` coverage count has numerator = distinct candidate report IDs with at least one completed M3 report import; denominator = distinct non-null report IDs referenced by vote events in the latest completed M2 session snapshot; period = 2025/26. The API also reports how many M2 vote **events** lack a verified report ID; these events are excluded from the denominator. Reports decided wholly without a recorded vote are absent from the M2-derived candidate set and cannot be counted in either side of this fraction. The count describes data linkage, not the share of parliamentary decisions recorded, and is not a member performance measure. With the first TU8 example alone, the fraction cannot be presented as complete 2025/26 coverage.

Worked integration fixture: one imported M2 vote references `HD01TU8` point 1 and vote ID `32518106-3c98-46ad-9271-fa4c5b1fca5e`, matching the [TU8 source document status](https://data.riksdagen.se/dokumentstatus/HD01TU8.json). With that single report imported, the fixture has numerator 1 and denominator 1; its second proposal point is marked `acklamation` and has no vote ID. The 1/1 is a fixture result for a one-report candidate set, never a claim about the real session.

## M3 decided-report catalog (2026-09-30)

The source list is [dokumentlista for decided 2025/26 committee reports](https://data.riksdagen.se/dokumentlista/?a=s&doktyp=bet&rm=2025/26&beslutad=1&utformat=json&sort=datum&sortorder=asc&p=1). In the inspected response, it reported 474 records over 24 pages (20 per page except the last). Fetching all pages with the explicit `sort=datum&sortorder=asc` returned 474 distinct document IDs. Fetches without an explicit sort repeated an ID across pages in the inspected sample. The importer therefore rejects missing/duplicated IDs, a changed total/page count, unexpected source filters or a broken next-page link. It publishes only a fully reconciled, versioned list. A per-page URL, SHA-256 and row count are stored, plus a hash of the ordered page hashes; the complete raw responses are not retained.

The catalog includes reports marked `beslutad=1` in the Riksdag's list, whether or not they appear in the M2 vote dataset. It does **not** represent every matter before the Riksdag or reports that have not been marked decided. Its `datum` is retained as a source date, not relabeled as a decision date. A report status is imported separately and may fail validation; such a document remains in the catalog denominator but not the status-import numerator.

The catalog coverage numerator is the number of unique catalog document IDs with a completed M3 status import; denominator is the number of document IDs in the latest complete decided-report catalog for 2025/26; exclusions are reports not marked decided or outside this session. If an M2 vote snapshot exists, a separate count shows catalog reports with at least one matching M2 vote event by document ID. **No vote event for a report** does not imply that every proposal point was decided without a vote or that its members were absent. Worked integration fixture: a two-report catalog contains the [TU8 report](https://data.riksdagen.se/dokumentstatus/HD01TU8.json) and one synthetic report with no vote event; one report status is imported and one M2 event references TU8. The fixture returns 1/2 status coverage and one report with a recorded vote. These are fixture counts, not 2025/26 totals.
