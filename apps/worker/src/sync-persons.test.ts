import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { syncPersons } from './sync-persons';
import type { PersonBatch } from './clients/person';

test(
  'reimport replaces source values without duplicating a stable ID',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const id = `${Date.now()}`;
    const sourceId = '570baaf6-f8fb-46bc-981e-1321b986039b';
    const batch: PersonBatch = {
      sourceUrl: 'https://data.riksdagen.se/personlista/?utformat=json',
      sourceDate: 'fixture',
      expectedCount: 1,
      batchCount: 1,
      items: [
        {
          sourceUrl:
            'https://data.riksdagen.se/personlista/?utformat=json&parti=M',
          sourceHash: 'fixture-hash',
          person: {
            personId: id,
            sourceId,
            partyCode: 'M',
            constituency: 'Test',
            givenName: 'First',
            lastName: 'Member',
            gender: 'man',
            birthYear: 1970,
            status: 'Tjänstgörande',
            politicianUrl: null,
            imageMax: null,
            assignments: [],
            attributes: [],
          },
        },
      ],
    };
    const { pgPool } = createDatabaseClient();
    const runIds: string[] = [];
    try {
      const first = await syncPersons(async () => batch);
      runIds.push(first.runId);
      batch.items[0].person.givenName = 'Corrected';
      const second = await syncPersons(async () => batch);
      runIds.push(second.runId);
      const { rows } = await pgPool.query(
        'SELECT given_name, import_run_id, source_hash FROM persons WHERE person_id = $1',
        [id],
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].given_name, 'Corrected');
      assert.equal(rows[0].import_run_id, second.runId);
      assert.notEqual(first.runId, second.runId);
      assert.equal(rows[0].source_hash, 'fixture-hash');
    } finally {
      await pgPool.query('DELETE FROM persons WHERE person_id = $1', [id]);
      if (runIds.length)
        await pgPool.query(
          'DELETE FROM import_runs WHERE id = ANY($1::uuid[])',
          [runIds],
        );
      await pgPool.end();
    }
  },
);
