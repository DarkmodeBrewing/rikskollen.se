import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { decisionFixture } from './clients/decision-fixture';
import { selectPendingReports, syncVoteLinkedDecisions } from './sync-vote-linked-decisions';

test('batch selects unique, missing vote-linked documents with a hard limit', () => {
  const selected = selectPendingReports(['HD01TU8', 'hd01tu8', 'HD01AU10'], ['hd01au10'], 1);
  assert.deepEqual(selected, {
    candidates: ['hd01tu8'], pendingBefore: 1, sourceDocumentCount: 2,
  });
  assert.throws(() => selectPendingReports(['HD010311'], [], 10), /Unsupported/);
  assert.throws(() => selectPendingReports(['HD01TU8'], [], 26), /Batch limit/);
});

test('batch resumes from completed reports and does not publish a failed document',
  { skip: !process.env.DATABASE_URL }, async () => {
    const { pgPool } = createDatabaseClient();
    let voteRunId: string | undefined;
    const reportId = 'HD01TU7';
    const raw = decisionFixture.replace(/HD01TU8/g, reportId).replace(/TU8/g, 'TU7');
    try {
      const run = await pgPool.query(`INSERT INTO vote_import_runs (session, source_url, source_hash, expected_files, event_count, choice_count, completed_at)
        VALUES ('2025/26', 'fixture', 'fixture', 1, 1, 349, now() + interval '1 minute') RETURNING id`);
      voteRunId = run.rows[0].id;
      await pgPool.query(`INSERT INTO vote_events (run_id, vote_id, session, designation, proposal_point, document_id, subject_type, main_vote_type, source_file, source_url, source_hash)
        VALUES ($1, '32518106-3c98-46ad-9271-fa4c5b1fca5e', '2025/26', 'TU7', '1', $2, 'sakfrågan', 'huvud', 'fixture.json', 'fixture', 'fixture')`, [voteRunId, reportId]);
      await assert.rejects(syncVoteLinkedDecisions(1, async () => raw.replace('"punkt":"2"', '"punkt":"1"')), /Stopped at HD01TU7/);
      const first = await syncVoteLinkedDecisions(1, async () => raw);
      assert.equal(first.sourceDocumentCount, 1);
      assert.equal(first.pendingBefore, 1);
      assert.equal(first.imported[0].pointCount, 2);
      const second = await syncVoteLinkedDecisions(1, async () => { throw new Error('Should not fetch'); });
      assert.equal(second.pendingBefore, 0);
      assert.deepEqual(second.imported, []);
    } finally {
      await pgPool.query('DELETE FROM decision_import_runs WHERE upper(document_id) = $1', [reportId]);
      if (voteRunId) await pgPool.query('DELETE FROM vote_import_runs WHERE id = $1', [voteRunId]);
      await pgPool.end();
    }
  });
