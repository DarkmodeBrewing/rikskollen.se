import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';

test(
  'latest import is searchable and detail links to its source',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { app } = await import('./server');
    const { closeDatabase } = await import('./db');
    const { pgPool } = createDatabaseClient();
    const id = `${Date.now()}`;
    let runId: string | undefined;
    try {
      const run = await pgPool.query(
        `INSERT INTO import_runs (source_url, source_date, expected_count, imported_count, batch_count, completed_at)
      VALUES ($1, 'fixture', 1, 1, 1, now()) RETURNING id`,
        ['https://data.riksdagen.se/personlista/?utformat=json'],
      );
      runId = run.rows[0].id;
      await pgPool.query(
        `INSERT INTO persons (person_id, sourceid, given_name, last_name, party_code, constituency, source_url, source_hash, fetched_at, import_run_id)
      VALUES ($1, $2, 'Ada', 'Test', 'M', 'Stockholm', $3, 'fixture-hash', now(), $4)`,
        [
          id,
          '883ef7d9-9c2c-4355-9b91-038ce39c4933',
          'https://data.riksdagen.se/personlista/?utformat=json&parti=M',
          runId,
        ],
      );
      const list = await app.inject('/api/persons?q=Ada');
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().total, 1);
      assert.equal(list.json().items[0].personId, id);
      const detail = await app.inject(`/api/persons/${id}`);
      assert.equal(detail.statusCode, 200);
      assert.match(detail.json().sourceUrl, /data\.riksdagen\.se/);
      const status = await app.inject('/api/import-status');
      assert.equal(status.json().complete, true);
      const dataStatus = (await app.inject('/api/data-status')).json();
      const members = dataStatus.coverage.find((row: { dataset: string }) => row.dataset === 'members');
      assert.equal(members.importedCount, 1);
      assert.equal(members.expectedCount, 1);
      assert.equal(members.snapshotId, runId);
      assert.equal(members.complete, true);
      assert.equal((await app.inject('/api/persons?page=0')).statusCode, 400);
      assert.equal(
        (await app.inject('/api/persons/999999999')).statusCode,
        404,
      );
    } finally {
      await pgPool.query('DELETE FROM persons WHERE person_id = $1', [id]);
      if (runId)
        await pgPool.query('DELETE FROM import_runs WHERE id = $1', [runId]);
      await pgPool.end();
      await app.close();
      await closeDatabase();
    }
  },
);
