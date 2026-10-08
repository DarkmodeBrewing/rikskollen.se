import type { createDatabaseClient } from '@rikskollen/db';
import type {
  DataStatus,
  PublishedCoverage,
  PublicImportAttempt,
} from '@rikskollen/shared-types';

type Pool = ReturnType<typeof createDatabaseClient>['pgPool'];
type PoolClient = Pick<Pool, 'query'>;

const attempts = `SELECT id, dataset, job, session, document_id AS "documentId", status, trigger, unchanged,
  expected_count AS "expectedCount", imported_count AS "importedCount", snapshot_id AS "snapshotId",
  started_at AS "startedAt", finished_at AS "finishedAt",
  CASE WHEN finished_at IS NOT NULL THEN greatest(0, extract(epoch FROM finished_at - started_at))::float END AS "durationSeconds"
  FROM import_attempts`;
type AttemptRow = Omit<PublicImportAttempt, 'startedAt' | 'finishedAt'> & {
  startedAt: Date;
  finishedAt: Date | null;
};
const publicAttempt = (row: AttemptRow): PublicImportAttempt => ({
  ...row,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
});

// Counts, snapshot references and history share a single consistent read view.
export async function readDataStatus(
  pool: Pool,
  page: number,
): Promise<DataStatus> {
  const client = await pool.connect();
  try {
    await client.query(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const coverage = await readCoverage(client);
    const history = await client.query<AttemptRow>(
      `${attempts} ORDER BY started_at DESC, id DESC LIMIT 20 OFFSET $1`,
      [(page - 1) * 20],
    );
    const totals = await client.query<{
      total: number;
      trackingStartedAt: Date | null;
    }>(
      'SELECT count(*)::int AS total, min(started_at) AS "trackingStartedAt" FROM import_attempts',
    );
    const latest = await client.query<AttemptRow>(
      `SELECT DISTINCT ON (job) * FROM (${attempts}) a ORDER BY job, "startedAt" DESC, id DESC`,
    );
    await client.query('COMMIT');
    return {
      generatedAt: new Date().toISOString(),
      trackingStartedAt:
        totals.rows[0].trackingStartedAt?.toISOString() ?? null,
      coverage,
      latestAttempts: latest.rows.map(publicAttempt),
      history: {
        items: history.rows.map(publicAttempt),
        total: totals.rows[0].total,
        page,
        limit: 20,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function readCoverage(client: PoolClient): Promise<PublishedCoverage[]> {
  const results: PublishedCoverage[] = [];
  const members =
    await client.query(`SELECT r.id, r.source_url, r.expected_count, r.imported_count, r.completed_at,
    (SELECT count(*)::int FROM persons p WHERE p.import_run_id = r.id) AS actual
    FROM import_runs r ORDER BY completed_at DESC, id DESC LIMIT 1`);
  if (members.rows[0]) {
    const r = members.rows[0];
    results.push({
      dataset: 'members',
      session: null,
      snapshotId: r.id,
      sourceUrl: r.source_url,
      expectedCount: r.expected_count,
      importedCount: r.actual,
      complete:
        r.actual === r.expected_count && r.imported_count === r.expected_count,
      lastSuccessfulAt: r.completed_at.toISOString(),
      oldestSuccessfulAt: r.completed_at.toISOString(),
      secondaryCount: null,
    });
  }
  const votes = await client.query(`SELECT r.*,
    (SELECT count(*)::int FROM vote_events v WHERE v.run_id = r.id) AS actual,
    (SELECT count(*)::int FROM vote_choices c WHERE c.run_id = r.id) AS choices
    FROM vote_import_runs r WHERE session = '2025/26' AND completed_at IS NOT NULL
    ORDER BY completed_at DESC, id DESC LIMIT 1`);
  if (votes.rows[0]) {
    const r = votes.rows[0];
    results.push({
      dataset: 'votes',
      session: r.session,
      snapshotId: r.id,
      sourceUrl: r.source_url,
      expectedCount: r.expected_files,
      importedCount: r.actual,
      complete:
        r.actual === r.expected_files &&
        r.actual === r.event_count &&
        r.choices === r.choice_count &&
        r.choices === r.actual * 349,
      lastSuccessfulAt: r.completed_at.toISOString(),
      oldestSuccessfulAt: r.completed_at.toISOString(),
      secondaryCount: r.choices,
    });
  }
  const catalog = await client.query(`SELECT r.*,
    (SELECT count(*)::int FROM report_catalog_entries c WHERE c.run_id = r.id) AS actual
    FROM report_catalog_runs r WHERE session = '2025/26' AND completed_at IS NOT NULL
    ORDER BY completed_at DESC, id DESC LIMIT 1`);
  if (catalog.rows[0]) {
    const r = catalog.rows[0];
    results.push({
      dataset: 'catalog',
      session: r.session,
      snapshotId: r.id,
      sourceUrl: r.source_url,
      expectedCount: r.expected_count,
      importedCount: r.actual,
      complete: r.actual === r.expected_count,
      lastSuccessfulAt: r.completed_at.toISOString(),
      oldestSuccessfulAt: r.completed_at.toISOString(),
      secondaryCount: null,
    });
    const reports = await client.query(
      `WITH latest AS (
      SELECT DISTINCT ON (upper(document_id)) id, document_id, completed_at
      FROM decision_import_runs WHERE completed_at IS NOT NULL
      ORDER BY upper(document_id), completed_at DESC, id DESC
    ), scoped AS (
      SELECT l.* FROM report_catalog_entries c
      JOIN latest l ON upper(l.document_id) = upper(c.document_id)
      JOIN decision_documents d ON d.run_id = l.id AND d.session = $2
      WHERE c.run_id = $1
    ) SELECT count(*)::int AS imported,
      min(completed_at) AS oldest, max(completed_at) AS newest,
      (SELECT count(*)::int FROM decision_points p JOIN scoped s ON p.run_id = s.id) AS points
      FROM scoped`,
      [r.id, r.session],
    );
    const d = reports.rows[0];
    // Catalog time is not a report refresh. With no report imports we expose
    // zero coverage, but no invented report-success timestamp.
    results.push({
      dataset: 'decisions',
      session: r.session,
      snapshotId: r.id,
      sourceUrl: r.source_url,
      expectedCount: r.actual,
      importedCount: d.imported,
      complete: d.imported === r.actual && r.actual === r.expected_count,
      lastSuccessfulAt: d.newest?.toISOString() ?? null,
      oldestSuccessfulAt: d.oldest?.toISOString() ?? null,
      secondaryCount: d.points,
    });
  }
  return results;
}
