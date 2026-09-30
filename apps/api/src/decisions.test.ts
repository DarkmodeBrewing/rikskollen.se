import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';

test('decision detail distinguishes a matched recorded vote from an acclamation point',
  { skip: !process.env.DATABASE_URL }, async () => {
    const { app } = await import('./server');
    const { closeDatabase } = await import('./db');
    const { pgPool } = createDatabaseClient();
    let decisionRun: string | undefined;
    let voteRun: string | undefined;
    let catalogRun: string | undefined;
    const voteId = '32518106-3c98-46ad-9271-fa4c5b1fca5e';
    try {
      const inserted = await pgPool.query(`INSERT INTO decision_import_runs (document_id, source_url, source_hash, expected_points, completed_at)
        VALUES ('HD01TU8', 'https://data.riksdagen.se/dokumentstatus/HD01TU8.json', 'fixture', 2, now()) RETURNING id`);
      decisionRun = inserted.rows[0].id;
      await pgPool.query(`INSERT INTO decision_documents (run_id, document_id, session, designation, title, status)
        VALUES ($1, 'HD01TU8', '2025/26', 'TU8', 'Digitaliserings- och postfrågor', 'Webbpublicering')`, [decisionRun]);
      await pgPool.query(`INSERT INTO decision_points (run_id, point, heading, proposal_text, decision_type, source_vote_id) VALUES
        ($1, '1', 'Utgångspunkter', 'Riksdagen avslår motionerna', 'röstning', $2),
        ($1, '2', 'Digital delaktighet', 'Riksdagen avslår motionerna', 'acklamation', null)`, [decisionRun, voteId]);
      const before = await app.inject('/api/decisions/HD01TU8');
      assert.equal(before.statusCode, 200);
      assert.equal(before.json().points[0].localVoteAvailable, false);
      assert.equal(before.json().points[1].sourceVoteId, null);
      const insertedVote = await pgPool.query(`INSERT INTO vote_import_runs (session, source_url, source_hash, expected_files, event_count, choice_count, completed_at)
        VALUES ('2025/26', 'fixture', 'fixture', 1, 1, 349, now()) RETURNING id`);
      voteRun = insertedVote.rows[0].id;
      await pgPool.query(`INSERT INTO vote_events (run_id, vote_id, session, designation, proposal_point, document_id, subject_type, main_vote_type, source_file, source_url, source_hash)
        VALUES ($1, $2, '2025/26', 'TU8', '1', 'HD01TU8', 'sakfrågan', 'huvud', 'fixture.json', 'fixture', 'fixture')`, [voteRun, voteId]);
      const insertedCatalog = await pgPool.query(`INSERT INTO report_catalog_runs (session, source_url, source_hash, expected_count, page_count, completed_at)
        VALUES ('2025/26', 'https://data.riksdagen.se/dokumentlista/?doktyp=bet&rm=2025/26&beslutad=1', 'fixture', 2, 1, now()) RETURNING id`);
      catalogRun = insertedCatalog.rows[0].id;
      await pgPool.query('INSERT INTO report_catalog_pages (run_id, page, source_url, source_hash, item_count) VALUES ($1, 1, $2, $3, 2)', [catalogRun, 'fixture', 'fixture']);
      await pgPool.query(`INSERT INTO report_catalog_entries (run_id, document_id, designation, title, page) VALUES
        ($1, 'HD01TU8', 'TU8', 'Digitaliserings- och postfrågor', 1),
        ($1, 'HD01TU7', 'TU7', 'Betänkande utan registrerad votering', 1)`, [catalogRun]);
      const after = await app.inject('/api/decisions/hd01tu8');
      assert.equal(after.statusCode, 200);
      assert.equal(after.json().points[0].localVoteAvailable, true);
      const listing = await app.inject('/api/decisions');
      assert.equal(listing.statusCode, 200);
      assert.equal(listing.json().total, 1);
      assert.equal(listing.json().coverage.voteRunId, voteRun);
      assert.equal(listing.json().coverage.sourceDocuments, 1);
      assert.equal(listing.json().coverage.importedDocuments, 1);
      assert.equal(listing.json().coverage.voteEventsWithoutDocument, 0);
      assert.equal(listing.json().catalogCoverage.sourceDocuments, 2);
      assert.equal(listing.json().catalogCoverage.importedDocuments, 1);
      assert.equal(listing.json().catalogCoverage.withRecordedVote, 1);
      assert.equal((await app.inject('/api/decisions?page=0')).statusCode, 400);
      const vote = await app.inject(`/api/votes/${voteId}`);
      assert.equal(vote.json().decisionTrailAvailable, true);
      assert.equal((await app.inject('/api/decisions/HD01TU9')).statusCode, 404);
    } finally {
      if (catalogRun) await pgPool.query('DELETE FROM report_catalog_runs WHERE id = $1', [catalogRun]);
      if (voteRun) await pgPool.query('DELETE FROM vote_import_runs WHERE id = $1', [voteRun]);
      if (decisionRun) await pgPool.query('DELETE FROM decision_import_runs WHERE id = $1', [decisionRun]);
      await pgPool.end();
      await app.close();
      await closeDatabase();
    }
  });
