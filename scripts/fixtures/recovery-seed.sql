-- Synthetic recovery fixture; not a Riksdag sample or a coverage claim.
INSERT INTO vote_import_runs (id, session, source_url, source_hash, expected_files, event_count, choice_count, completed_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'fixture', 'https://example.invalid/archive', 'recovery-fixture-hash', 1, 1, 1, '2026-01-01T00:00:00Z');
INSERT INTO vote_events (run_id, vote_id, session, designation, proposal_point, subject_type, main_vote_type, source_file, source_url, source_hash)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'fixture', 'fixture', '1', 'fixture', 'fixture', 'fixture.json', 'https://example.invalid/vote', 'recovery-event-hash');
INSERT INTO vote_choices (run_id, vote_id, person_id, source_name, party_code, constituency, choice)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'fixture-person', 'Synthetic fixture', 'fixture', 'fixture', 'Ja');
INSERT INTO import_attempts (dataset, job, status, trigger, unchanged, expected_count, imported_count, snapshot_id, finished_at)
VALUES ('votes', 'votes', 'succeeded', 'scheduled', true, 1, 0, '00000000-0000-4000-8000-000000000001', '2026-01-02T00:00:00Z');
