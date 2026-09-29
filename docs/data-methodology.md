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
