import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDataStatus } from './data-status';

test('title lookup is bounded to selected history/latest documents, with case/session deduplication', async () => {
  const now = new Date();
  const attempt = (
    id: string,
    documentId: string | null,
    session = '2025/26',
  ) => ({
    id,
    documentId,
    session,
    startedAt: now,
    finishedAt: now,
  });
  let lookups = 0;
  const client = {
    async query(sql: string, params?: unknown[]) {
      if (sql.includes('jsonb_to_recordset')) {
        lookups++;
        assert.deepEqual(JSON.parse(params![0] as string), [
          { documentId: 'HD01TU8', session: '2025/26' },
          { documentId: 'HD01TU9', session: '2025/26' },
          { documentId: 'HD01TU8', session: '2024/25' },
        ]);
        return {
          rows: [
            {
              documentId: 'HD01TU8',
              session: '2025/26',
              title: 'Current title',
            },
            { documentId: 'HD01TU9', session: '2025/26', title: null },
            {
              documentId: 'HD01TU8',
              session: '2024/25',
              title: 'Older session',
            },
          ],
        };
      }
      if (sql.includes('LIMIT 20 OFFSET')) {
        assert(!sql.includes('COALESCE')); // No per-attempt enrichment before paging.
        return {
          rows: [
            attempt('1', 'hd01tu8'),
            attempt('2', 'HD01TU9'),
            attempt('3', null),
          ],
        };
      }
      if (sql.includes('SELECT DISTINCT ON (job)')) {
        assert(!sql.includes('COALESCE')); // No enrichment of the complete attempt table.
        return {
          rows: [attempt('4', 'HD01TU8'), attempt('5', 'HD01TU8', '2024/25')],
        };
      }
      if (sql.includes('min(started_at)'))
        return { rows: [{ total: 100000, trackingStartedAt: now }] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Parameters<typeof readDataStatus>[0];
  const result = await readDataStatus(pool, 1);
  assert.equal(lookups, 1);
  assert.equal(result.history.total, 100000);
  assert.deepEqual(
    result.history.items.map((row) => row.documentTitle),
    ['Current title', null, null],
  );
  assert.deepEqual(
    result.latestAttempts.map((row) => row.documentTitle),
    ['Current title', 'Older session'],
  );
});
