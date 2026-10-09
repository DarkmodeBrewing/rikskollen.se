-- Fail if the operational schema or migration history is missing.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations) THEN
    RAISE EXCEPTION 'Migration history is empty';
  END IF;
END $$;
SELECT count(*) AS migration_count FROM drizzle.__drizzle_migrations;
SELECT trigger, unchanged FROM public.import_attempts LIMIT 0;
-- Restored table counts include staging, history and source records, not just
-- currently published coverage. Keep this report private; compare with API
-- coverage separately rather than calling all retained versions current data.
SELECT format('SELECT %L AS table_name, count(*) AS row_count FROM %I.%I;',
              schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname IN ('public', 'drizzle')
ORDER BY schemaname, tablename
\gexec
SELECT id, source_url, completed_at FROM public.import_runs ORDER BY completed_at, id;
SELECT id, session, source_url, source_hash, expected_files, event_count,
       choice_count, completed_at FROM public.vote_import_runs ORDER BY started_at, id;
SELECT id, session, source_url, source_hash, expected_count, page_count, completed_at
FROM public.report_catalog_runs ORDER BY started_at, id;
SELECT id, document_id, source_url, source_hash, expected_points, completed_at
FROM public.decision_import_runs ORDER BY started_at, id;
