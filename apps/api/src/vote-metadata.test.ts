import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';

test('detail dates order events and reduce unknown-date counts without overwriting archive dates',
  { skip: !process.env.DATABASE_URL }, async () => {
    const { pgPool } = createDatabaseClient();
    const { listVotes, getMemberVotes, closeDatabase } = await import('./db');
    let runId: string | undefined;
    try {
      runId = (await pgPool.query(`INSERT INTO vote_import_runs(session,source_url,source_hash,expected_files,event_count,completed_at) VALUES('2025/26','fixture','fixture',2,2,'2040-01-01') RETURNING id`)).rows[0].id;
      await pgPool.query(`INSERT INTO vote_events(run_id,vote_id,session,designation,proposal_point,subject_type,main_vote_type,vote_date,detail_date,detail_title,detail_source_url,source_file,source_url,source_hash) VALUES
        ($1,'00000000-0000-0000-0000-000000000001','2025/26','TEST','0','sak','huvud',null,'2026-03-11','Source title','https://data.riksdagen.se/votering/example/json','one','source','hash'),
        ($1,'00000000-0000-0000-0000-000000000002','2025/26','TEST','1','sak','huvud','2026-03-04',null,null,null,'two','source','hash')`, [runId]);
      await pgPool.query(`INSERT INTO vote_choices(run_id,vote_id,person_id,source_name,party_code,constituency,choice) SELECT run_id,vote_id,'0000000000001','Synthetic','TEST','Test','Ja' FROM vote_events WHERE run_id=$1`, [runId]);
      const votes = await listVotes(1, 30);
      assert.equal(votes.items[0].detailTitle, 'Source title');
      assert.equal(votes.items[0].voteDate, null);
      assert.equal(votes.items[0].detailDate, '2026-03-11');
      const history = await getMemberVotes('0000000000001', 1, 20);
      assert.equal(history.summary?.eventsWithoutDate, 0);
      assert.equal(history.summary?.recordedEvents, 2);
    } finally {
      if (runId) await pgPool.query('DELETE FROM vote_import_runs WHERE id=$1', [runId]);
      await pgPool.end(); await closeDatabase();
    }
  });
