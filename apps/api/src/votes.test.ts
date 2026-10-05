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
    let correctedRunId: string | undefined;
    let pendingRunId: string | undefined;
    try {
      const empty = (await app.inject('/api/persons/0000000000001/votes')).json();
      assert.equal(empty.summary, null);
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
      assert.equal(history.json().summary.recordedEvents, 1);
      assert.deepEqual(history.json().summary.choices, [{ choice: 'Frånvarande', count: 1 }]);
      const status = await app.inject('/api/votes/import-status');
      assert.equal(status.json().complete, true);
      const voteCoverage = (await app.inject('/api/data-status')).json().coverage.find((row: { dataset: string }) => row.dataset === 'votes');
      assert.equal(voteCoverage.importedCount, 1);
      assert.equal(voteCoverage.expectedCount, 1);
      assert.equal(voteCoverage.secondaryCount, 349);
      assert.equal(voteCoverage.complete, true);

      // Synthetic events exercise each source choice, an unexpected value, a
      // missing date and a substituted person ID; none imply eligible attendance.
      await pgPool.query(`INSERT INTO vote_events (run_id, vote_id, session, designation, proposal_point, subject_type, main_vote_type, vote_date, source_file, source_url, source_hash)
        SELECT $1, ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
          '2025/26', 'Fixture', n::text, 'motiveringen', 'huvud',
          CASE WHEN n = 5 THEN null ELSE '2026-03-05' END, 'synthetic.json', 'fixture', 'fixture'
        FROM generate_series(1, 6) AS n`, [runId]);
      await pgPool.query(`INSERT INTO vote_choices (run_id, vote_id, person_id, source_name, party_code, constituency, choice)
        SELECT $1, ('00000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
          lpad((CASE WHEN v.n = 6 AND p.n = 1 THEN 350 ELSE p.n END)::text, 13, '0'),
          'Ledamot ' || p.n, 'S', 'Stockholm',
          CASE WHEN p.n != 1 THEN 'Ja' WHEN v.n IN (1, 2) THEN 'Ja'
            WHEN v.n = 3 THEN 'Nej' WHEN v.n = 4 THEN 'Avstår' ELSE 'Källvärde' END
        FROM generate_series(1, 6) AS v(n) CROSS JOIN generate_series(1, 349) AS p(n)`, [runId]);
      await pgPool.query('UPDATE vote_import_runs SET expected_files = 7, event_count = 7, choice_count = 2443 WHERE id = $1', [runId]);
      const filtered = (await app.inject('/api/persons/0000000000001/votes?choice=Ja&limit=1')).json();
      assert.equal(filtered.total, 2);
      assert.equal(filtered.choice, 'Ja');
      assert.equal(filtered.items.length, 1);
      assert.equal(filtered.items[0].choice, 'Ja');
      assert.equal(filtered.summary.recordedEvents, 6);
      assert.equal(filtered.summary.sourceEvents, 7);
      assert.equal(filtered.summary.eventsWithoutMemberRecord, 1);
      assert.equal(filtered.summary.eventsWithoutDate, 1);
      assert.equal(filtered.summary.voteRunId, runId);
      assert.equal(filtered.summary.choices.reduce((sum: number, group: { count: number }) => sum + group.count, 0), 6);
      assert.equal(filtered.summary.choices.find((group: { choice: string }) => group.choice === 'Frånvarande').count, 1);
      const secondPage = (await app.inject('/api/persons/0000000000001/votes?choice=Ja&limit=1&page=2')).json();
      assert.equal(secondPage.items[0].choice, 'Ja');
      assert.notEqual(secondPage.items[0].event.voteId, filtered.items[0].event.voteId);
      assert.deepEqual(secondPage.summary, filtered.summary);
      const unexpected = (await app.inject('/api/persons/0000000000001/votes?choice=K%C3%A4llv%C3%A4rde')).json();
      assert.equal(unexpected.total, 1);
      assert.equal(unexpected.items[0].choice, 'Källvärde');
      const missingPerson = (await app.inject('/api/persons/9999999999999/votes')).json();
      assert.equal(missingPerson.summary.recordedEvents, 0);
      assert.equal(missingPerson.summary.eventsWithoutMemberRecord, 7);
      assert.deepEqual(missingPerson.summary.choices, []);
      assert.equal((await app.inject('/api/persons/0000000000001/votes?choice=' + 'x'.repeat(101))).statusCode, 400);

      // A complete correction replaces old rows, while a newer staged run stays hidden.
      const correctedRun = await pgPool.query(`INSERT INTO vote_import_runs (session, source_url, source_hash, expected_files, event_count, choice_count, completed_at)
        VALUES ('2025/26', 'corrected fixture', 'fixture', 1, 1, 349, now() + interval '1 second') RETURNING id`);
      correctedRunId = correctedRun.rows[0].id;
      await pgPool.query(`INSERT INTO vote_events (run_id, vote_id, session, designation, proposal_point, document_id, subject_type, main_vote_type, vote_date, source_file, source_url, source_hash)
        SELECT $1::uuid, vote_id, session, designation, proposal_point, document_id, subject_type, main_vote_type, vote_date, source_file, source_url, source_hash
        FROM vote_events WHERE run_id = $2 AND vote_id = $3`, [correctedRunId, runId, voteId]);
      await pgPool.query(`INSERT INTO vote_choices (run_id, vote_id, person_id, source_name, party_code, constituency, choice)
        SELECT $1::uuid, vote_id, person_id, source_name, party_code, constituency, 'Nej'
        FROM vote_choices WHERE run_id = $2 AND vote_id = $3`, [correctedRunId, runId, voteId]);
      const pending = await pgPool.query(`INSERT INTO vote_import_runs (session, source_url, source_hash, expected_files)
        VALUES ('2025/26', 'pending fixture', 'fixture', 1) RETURNING id`);
      pendingRunId = pending.rows[0].id;
      const corrected = (await app.inject('/api/persons/0000000000001/votes')).json();
      assert.equal(corrected.summary.voteRunId, correctedRunId);
      assert.equal(corrected.summary.recordedEvents, 1);
      assert.deepEqual(corrected.summary.choices, [{ choice: 'Nej', count: 1 }]);
      assert.equal(corrected.items[0].choice, 'Nej');
      const correctedCoverage = (await app.inject('/api/data-status')).json().coverage.find((row: { dataset: string }) => row.dataset === 'votes');
      assert.equal(correctedCoverage.snapshotId, correctedRunId);
      assert.equal(correctedCoverage.importedCount, 1);
      // Missing choice rows are surfaced rather than claiming completeness.
      await pgPool.query('DELETE FROM vote_choices WHERE run_id = $1 AND person_id = $2', [correctedRunId, '0000000000001']);
      const incompleteCoverage = (await app.inject('/api/data-status')).json().coverage.find((row: { dataset: string }) => row.dataset === 'votes');
      assert.equal(incompleteCoverage.secondaryCount, 348);
      assert.equal(incompleteCoverage.complete, false);
    } finally {
      if (pendingRunId) await pgPool.query('DELETE FROM vote_import_runs WHERE id = $1', [pendingRunId]);
      if (correctedRunId) await pgPool.query('DELETE FROM vote_import_runs WHERE id = $1', [correctedRunId]);
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
