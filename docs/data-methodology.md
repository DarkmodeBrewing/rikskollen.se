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
