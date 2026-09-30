import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';

test(
  'vote detail, source counts, and member history use the completed session',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { app } = await import('./server');
    const { closeDatabase } = await import('./db');
    const { pgPool } = createDatabaseClient();
    const voteId = '24315a72-da70-49d3-9498-f15c5504f256';
    let runId: string | undefined;
    try {
      const run =
        await pgPool.query(`INSERT INTO vote_import_runs (session, source_url, source_hash, expected_files, event_count, choice_count, completed_at)
      VALUES ('2025/26', 'https://data.riksdagen.se/dataset/votering/votering-202526.json.zip', 'fixture', 1, 1, 349, now()) RETURNING id`);
      runId = run.rows[0].id;
      await pgPool.query(
        `INSERT INTO vote_events (run_id, vote_id, session, designation, proposal_point, document_id, subject_type, main_vote_type, vote_date, source_file, source_url, source_hash)
      VALUES ($1, $2, '2025/26', 'AU10', '13', 'HD01AU10', 'sakfrågan', 'huvud', '2026-03-04', 'fixture.json', $3, 'fixture')`,
        [runId, voteId, `https://data.riksdagen.se/votering/${voteId}`],
      );
      await pgPool.query(
        `INSERT INTO vote_choices (run_id, vote_id, person_id, source_name, party_code, constituency, choice)
      SELECT $1, $2, lpad(n::text, 13, '0'), 'Ledamot ' || n, 'S', 'Stockholm', CASE WHEN n = 1 THEN 'Frånvarande' ELSE 'Ja' END
      FROM generate_series(1, 349) AS n`,
        [runId, voteId],
      );
      const list = await app.inject('/api/votes');
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().total, 1);
      const detail = await app.inject(`/api/votes/${voteId}`);
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.json().counts.Ja, 348);
      assert.equal(detail.json().counts.Frånvarande, 1);
      assert.equal(detail.json().event.documentId, 'HD01AU10');
      const history = await app.inject('/api/persons/0000000000001/votes');
      assert.equal(history.json().total, 1);
      assert.equal(history.json().items[0].choice, 'Frånvarande');
      const status = await app.inject('/api/votes/import-status');
      assert.equal(status.json().complete, true);
    } finally {
      if (runId)
        await pgPool.query('DELETE FROM vote_import_runs WHERE id = $1', [
          runId,
        ]);
      await pgPool.end();
      await app.close();
      await closeDatabase();
    }
  },
);
