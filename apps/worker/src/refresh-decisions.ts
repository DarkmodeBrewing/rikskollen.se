import { createDatabaseClient } from '@rikskollen/db';
import {
  documentIdSchema,
  downloadDecisionStatus,
} from './clients/decision-status';
import { recordImportAttempt } from './lib/import-attempt';
import { syncDecision } from './sync-decisions';

const DAY = 86400000;
export interface RefreshCandidate {
  documentId: string;
  sourceDate: string | null;
  checkedAt: Date;
}
// Reserve half the budget for older material, so a busy recent window cannot
// permanently starve historical corrections. Empty groups donate their slots.
export function selectRefreshReports(
  rows: RefreshCandidate[],
  now: Date,
  limit: number,
): string[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new Error('Batch limit must be between 1 and 25');
  const recent: RefreshCandidate[] = [],
    older: RefreshCandidate[] = [];
  const today = Date.parse(now.toISOString().slice(0, 10));
  const seen = new Set<string>();
  for (const row of rows) {
    const id = documentIdSchema.parse(row.documentId);
    if (seen.has(id)) throw new Error(`Duplicate refresh candidate ${id}`);
    seen.add(id);
    const date =
      row.sourceDate && /^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(row.sourceDate)
        ? Date.parse(row.sourceDate.slice(0, 10))
        : NaN;
    const isRecent =
      Number.isFinite(date) &&
      new Date(date).toISOString().slice(0, 10) ===
        row.sourceDate?.slice(0, 10) &&
      date <= today &&
      date >= today - 29 * DAY;
    const age = now.getTime() - row.checkedAt.getTime();
    if (!Number.isFinite(age)) throw new Error('Invalid last-check time');
    if (age >= (isRecent ? DAY : 7 * DAY))
      (isRecent ? recent : older).push({ ...row, documentId: id });
  }
  const sort = (a: RefreshCandidate, b: RefreshCandidate) =>
    a.checkedAt.getTime() - b.checkedAt.getTime() ||
    a.documentId.localeCompare(b.documentId);
  recent.sort(sort);
  older.sort(sort);
  const recentBudget =
    limit === 1 ? Math.floor(now.getTime() / DAY) % 2 : Math.ceil(limit / 2);
  const selected = [
    ...recent.splice(0, recentBudget),
    ...older.splice(0, limit - recentBudget),
  ];
  selected.push(
    ...[...recent, ...older].sort(sort).slice(0, limit - selected.length),
  );
  return selected.map((row) => row.documentId);
}
export async function refreshDecisions(
  limit = 10,
  load = downloadDecisionStatus,
  now = new Date(),
) {
  return recordImportAttempt(
    { dataset: 'decisions', job: 'refresh-decisions', session: '2025/26' },
    async (progress) => {
      const { pgPool } = createDatabaseClient();
      let selected: string[];
      try {
        const result = await pgPool.query<{
          documentId: string;
          sourceDate: string | null;
          checkedAt: Date;
        }>(`
        WITH catalog AS (SELECT id FROM report_catalog_runs WHERE session = '2025/26' AND completed_at IS NOT NULL ORDER BY completed_at DESC, id DESC LIMIT 1),
        latest AS (SELECT DISTINCT ON (document_id) document_id, completed_at FROM decision_import_runs WHERE completed_at IS NOT NULL ORDER BY document_id, completed_at DESC, id DESC)
        SELECT c.document_id AS "documentId", c.source_date AS "sourceDate",
          greatest(l.completed_at, (SELECT max(finished_at) FROM import_attempts a WHERE a.document_id = c.document_id AND a.job = 'decision' AND a.status = 'succeeded')) AS "checkedAt"
        FROM report_catalog_entries c JOIN catalog r ON c.run_id = r.id JOIN latest l ON c.document_id = l.document_id`);
        selected = selectRefreshReports(result.rows, now, limit);
      } finally {
        await pgPool.end();
      }
      await progress.expected(selected.length);
      let published = 0;
      const failed: string[] = [];
      for (const id of selected) {
        try {
          const result = await syncDecision(id, load, true);
          if (!result.unchanged) {
            published++;
            await progress.published(published);
          }
        } catch (error) {
          failed.push(id);
          console.error(`Correction failed for ${id}`, error);
        }
      }
      if (failed.length)
        throw new Error(
          `Correction batch failed for ${failed.join(', ')}; completed reports remain published`,
        );
      return { checked: selected.length, published };
    },
    (result) => ({
      importedCount: result.published,
      unchanged: result.checked > 0 && result.published === 0,
    }),
  );
}
