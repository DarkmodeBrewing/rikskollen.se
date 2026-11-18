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

test('detail metadata is versioned with the archive; unchanged checks and metadata corrections reconcile',
  { skip: !process.env.DATABASE_URL }, async () => {
    const { parseVoteDetail } = await import('./clients/vote-detail');
    const { readFileSync } = await import('node:fs');
    const { pgPool } = createDatabaseClient();
    const ids: string[] = [];
    const rows = fixtureRows().map(row => ({ ...row, datum: null }));
    const source = JSON.parse(readFileSync(new URL('./clients/fixtures/vote-detail-80c0be09-4795-45d8-a51e-5ca1f8d751da.json', import.meta.url), 'utf8'));
    Object.assign(source.votering.dokument, { sourceid: rows[0].votering_id, beteckning: 'AU10', tempbeteckning: '13' });
    const load = async (event: Parameters<typeof parseVoteDetail>[1]) => parseVoteDetail(JSON.stringify(source), event);
    try {
      const first = await syncVotes(async () => fixtureArchive(rows), false, load);
      ids.push(first.runId);
      const stored = (await pgPool.query('SELECT vote_date, detail_date, detail_title, detail_source_url, detail_source_hash, detail_fetched_at FROM vote_events WHERE run_id=$1', [first.runId])).rows[0];
      assert.equal(stored.vote_date, null);
      assert.equal(stored.detail_date, '2026-03-11');
      assert.equal(stored.detail_title, source.votering.dokument.titel);
      assert.match(stored.detail_source_hash, /^[a-f0-9]{64}$/);
      assert.ok(stored.detail_fetched_at);
      const unchanged = await syncVotes(async () => fixtureArchive(rows), true, load);
      assert.equal(unchanged.unchanged, true);
      assert.equal(unchanged.runId, first.runId);
      source.votering.dokument.titel += ' (rättad)';
      const corrected = await syncVotes(async () => fixtureArchive(rows), true, load);
      ids.push(corrected.runId);
      assert.equal(corrected.unchanged, false);
      assert.notEqual(corrected.runId, first.runId);
      await assert.rejects(syncVotes(async () => fixtureArchive(rows), false, async () => { throw new Error('detail unavailable'); }), /detail unavailable/);
      assert.equal((await pgPool.query('SELECT count(*)::int AS count FROM vote_import_runs WHERE id=ANY($1::uuid[]) AND completed_at IS NOT NULL', [ids])).rows[0].count, 2);
      assert.equal((await pgPool.query('SELECT detail_title FROM vote_events WHERE run_id=$1', [first.runId])).rows[0].detail_title, stored.detail_title);
    } finally {
      if (ids.length) await pgPool.query('DELETE FROM vote_import_runs WHERE id=ANY($1::uuid[])', [ids]);
      await pgPool.end();
    }
  });
