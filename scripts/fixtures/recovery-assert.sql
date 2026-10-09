DO $$ BEGIN
  IF (SELECT count(*) FROM vote_choices) <> 1 THEN RAISE EXCEPTION 'Choice rows lost'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vote_choices c
    JOIN vote_events e USING (run_id, vote_id)
    JOIN vote_import_runs r ON r.id = c.run_id
    WHERE c.person_id = 'fixture-person' AND c.choice = 'Ja'
      AND e.source_hash = 'recovery-event-hash'
      AND r.source_hash = 'recovery-fixture-hash'
      AND r.source_url = 'https://example.invalid/archive'
      AND r.completed_at = '2026-01-01T00:00:00Z'
  ) THEN RAISE EXCEPTION 'Restored source linkage/provenance differs'; END IF;
  IF (SELECT count(*) FROM import_attempts WHERE status = 'succeeded'
       AND trigger = 'scheduled' AND unchanged = true AND imported_count = 0
       AND snapshot_id = '00000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Operational history lost';
  END IF;
END $$;
