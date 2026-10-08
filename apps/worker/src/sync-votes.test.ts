import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { fixtureArchive, fixtureRows } from './clients/vote-fixture';
import { syncVotes } from './sync-votes';

process.env.RIKSDAG_API_URL = 'https://data.riksdagen.se';
test(
  'repeat import publishes distinct complete snapshots and reconciles 349 choices',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    const ids: string[] = [];
    try {
      for (let i = 0; i < 2; i++) {
        const result = await syncVotes(async () => fixtureArchive());
        ids.push(result.runId);
        assert.equal(result.eventCount, 1);
        assert.equal(result.choiceCount, 349);
      }
      assert.notEqual(ids[0], ids[1]);
      const { unzipSync, zipSync } = await import('fflate');
      const repacked = zipSync(unzipSync(fixtureArchive()), {
        mtime: new Date('2020-01-01'),
      });
      const checked = await syncVotes(async () => repacked, true);
      assert.equal(checked.runId, ids[1]);
      assert.equal(checked.unchanged, true);
      const changedRows = fixtureRows();
      changedRows[1].rost = 'Nej';
      const corrected = await syncVotes(
        async () => fixtureArchive(changedRows),
        true,
      );
      assert.equal(corrected.unchanged, false);
      assert.notEqual(corrected.runId, checked.runId);
      ids.push(corrected.runId);
      const { rows } = await pgPool.query(
        `SELECT run_id, count(*)::int AS choices FROM vote_choices WHERE run_id = ANY($1::uuid[]) GROUP BY run_id`,
        [ids],
      );
      assert.deepEqual(rows.map((row) => row.choices).sort(), [349, 349, 349]);
      const runs = await pgPool.query(
        'SELECT completed_at FROM vote_import_runs WHERE id = ANY($1::uuid[])',
        [ids],
      );
      assert.equal(
        runs.rows.every((row) => row.completed_at !== null),
        true,
      );
    } finally {
      if (ids.length)
        await pgPool.query(
          'DELETE FROM vote_import_runs WHERE id = ANY($1::uuid[])',
          [ids],
        );
      await pgPool.end();
    }
  },
);

test(
  'duplicate event aborts and removes staged run',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    const { unzipSync, zipSync } = await import('fflate');
    const single = unzipSync(fixtureArchive());
    const [name] = Object.keys(single);
    const duplicate = zipSync({
      [name]: single[name],
      [name.replace('HD01AU10', 'HD01AU11')]: single[name],
    });
    try {
      const before = await pgPool.query(
        'SELECT count(*)::int AS count FROM vote_import_runs',
      );
      await assert.rejects(
        syncVotes(async () => duplicate),
        /Duplicate vote ID/,
      );
      const after = await pgPool.query(
        'SELECT count(*)::int AS count FROM vote_import_runs',
      );
      assert.equal(after.rows[0].count, before.rows[0].count);
    } finally {
      await pgPool.end();
    }
  },
);
