# Import readability follow-up

Scope: the four readability defects recorded in PR #28, after the bounded v1.0 direction in PR #29. No new datasets, schema migration or analytics are introduced.

## Behaviour

- Proposal HTML is stripped before one strict HTML entity decoding pass. Standard named entities preserve case (`&Aring;` versus `&aring;`); numeric references decode too. Encoded markup remains literal text, rendered by Angular interpolation. Source response hashes still cover the original bytes.
- Datastatus uses `publicerat`/`planerat` for one betänkande, plural `publicerade`/`planerade`, and common-gender wording for ledamöter/voteringar.
- Attempt history and latest attempts gain optional nullable `documentTitle`: most recent completed catalog entry in the attempt's session, then most recent completed report document in that session. Unknown titles stay null and IDs remain visible. These are current source labels, not historical titles captured when an attempt ran. No join multiplies attempts or changes paging/coverage counts.
- Newly generated recovery events describe a cleared incident and omit the old failure attempt ID. Failure events retain their reason/attempt ID. Existing persisted pending deliveries are replayed unchanged with their original delivery IDs; do not reset monitor state to change old wording.

## Verification

Local Node 24.15.0/pnpm 9.0.0: workspace build, worker/API TypeScript checks and E2E fixture checks passed. Local tests: three DB mapping tests and 27 worker tests passed; 14 worker and four API tests skipped without PostgreSQL/CI receiver. All 48 Playwright desktop/mobile checks passed against isolated fixture API/SSR servers. Database integration and packaged stack acceptance must also pass in CI. No live source import or deployment was performed.

## Deployment acceptance — NOT RUN

Build API/web/worker from the same accepted SHA using the deployment runbook. No new migration is required. Recreate the scheduler/monitor only as part of an approved rollout, retaining database and monitor state volumes. Do not start the opt-in monitor implicitly.

Existing proposal text does not change merely by deploying the decoder. Scheduled unchanged-source checks intentionally reuse the stored snapshot. After deployment approval, a bounded manual `worker dist/sync-decisions.js HD01CU21` republishes that report using the corrected decoder; it retains old versions and raw-response provenance. Verify the API and desktop/mobile report text, including “förslag”, “ändring” and “ärvdabalken”, and unchanged coverage. Other known affected reports need individually reviewed bounded replay; no mass rewrite or source-hash change is implied.

Check history titles and singular/plural wording on desktop/mobile, long-title wrapping, unknown-title IDs, paging/reload and no technical errors. Observe a genuine or isolated approved recovery event for the new reason/no-old-attempt-ID contract and repeat to verify no duplicate transition. Actual receiver delivery, external monitoring, off-host restore and the remaining v1.0 gates stay separate.
