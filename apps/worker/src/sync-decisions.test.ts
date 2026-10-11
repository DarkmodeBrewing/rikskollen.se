import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
      const missingPoints = JSON.parse(decisionFixture);
      delete missingPoints.dokumentstatus.dokutskottsforslag;
      await assert.rejects(
        syncDecision('HD01TU8', async () => JSON.stringify(missingPoints)),
        /Structured proposal points unavailable/,
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

test(
  'CU21 is published with both source fields while FiU10 records failure without a snapshot',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    let runId: string | undefined;
    try {
      const raw = readFileSync(
        new URL('./clients/fixtures/HD01CU21.json', import.meta.url),
        'utf8',
      );
      const result = await syncDecision('HD01CU21', async () => raw);
      runId = result.runId;
      assert.equal(result.pointCount, 3);
      const point = await pgPool.query(
        'SELECT decision_type, source_vote_id FROM decision_points WHERE run_id = $1 AND point = $2',
        [runId, '2'],
      );
      assert.deepEqual(point.rows[0], {
        decision_type: 'acklamation',
        source_vote_id: '62fbd172-047f-402b-b878-f5ba1a07005b',
      });
      const unavailable = readFileSync(
        new URL('./clients/fixtures/HD01FiU10.json', import.meta.url),
        'utf8',
      );
      const before = await pgPool.query(
        'SELECT count(*)::int AS count FROM decision_import_runs WHERE upper(document_id) = $1',
        ['HD01FIU10'],
      );
      await assert.rejects(
        syncDecision('HD01FiU10', async () => unavailable),
        /Structured proposal points unavailable/,
      );
      const after = await pgPool.query(
        'SELECT count(*)::int AS count FROM decision_import_runs WHERE upper(document_id) = $1',
        ['HD01FIU10'],
      );
      assert.deepEqual(after.rows, before.rows);
      const attempt = await pgPool.query(
        "SELECT status, imported_count FROM import_attempts WHERE document_id = 'HD01FIU10' ORDER BY started_at DESC, id DESC LIMIT 1",
      );
      assert.deepEqual(attempt.rows[0], {
        status: 'failed',
        imported_count: 0,
      });
    } finally {
      if (runId)
        await pgPool.query('DELETE FROM decision_import_runs WHERE id = $1', [
          runId,
        ]);
      await pgPool.end();
    }
  },
);
