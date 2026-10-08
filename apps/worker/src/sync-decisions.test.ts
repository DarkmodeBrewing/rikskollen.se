import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { decisionFixture } from './clients/decision-fixture';
import { syncDecision } from './sync-decisions';

test(
  'complete report snapshots are replayable and an invalid update leaves the previous version intact',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    const ids: string[] = [];
    try {
      for (let index = 0; index < 2; index++) {
        const result = await syncDecision(
          'HD01TU8',
          async () => decisionFixture,
        );
        ids.push(result.runId);
        assert.equal(result.pointCount, 2);
      }
      assert.notEqual(ids[0], ids[1]);
      const checked = await syncDecision(
        'HD01TU8',
        async () => decisionFixture,
        true,
      );
      assert.equal(checked.runId, ids[1]);
      assert.equal(checked.unchanged, true);
      const attempt = await pgPool.query(
        'SELECT imported_count, unchanged, status FROM import_attempts WHERE snapshot_id = $1 ORDER BY started_at DESC LIMIT 1',
        [checked.runId],
      );
      assert.deepEqual(attempt.rows[0], {
        imported_count: 0,
        unchanged: true,
        status: 'succeeded',
      });
      await assert.rejects(
        syncDecision('HD01TU8', async () =>
          decisionFixture
            .replace('acklamation', 'röstning')
            .replace('"punkt":"2"', '"punkt":"1"'),
        ),
        /Duplicate proposal point/,
      );
      const rows = await pgPool.query(
        'SELECT r.id, r.completed_at, count(p.point)::int AS points FROM decision_import_runs r JOIN decision_points p ON p.run_id = r.id WHERE r.id = ANY($1::uuid[]) GROUP BY r.id',
        [ids],
      );
      assert.equal(rows.rows.length, 2);
      assert.ok(rows.rows.every((row) => row.completed_at && row.points === 2));
    } finally {
      if (ids.length)
        await pgPool.query(
          'DELETE FROM decision_import_runs WHERE id = ANY($1::uuid[])',
          [ids],
        );
      await pgPool.end();
    }
  },
);
