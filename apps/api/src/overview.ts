import type { createDatabaseClient } from '@rikskollen/db';
import type { Overview } from '@rikskollen/shared-types';
type Pool = ReturnType<typeof createDatabaseClient>['pgPool'];

// Select completed versions in the named session before joining points. Never
// enrich the complete history one row at a time or fetch sources on a read.
const scoped = `WITH latest AS MATERIALIZED (
  SELECT DISTINCT ON (upper(d.document_id)) r.id, d.document_id, d.designation,
    d.title, d.decision_date,
    (d.decision_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(d.decision_date, 'date')) AS dated, r.source_url, r.completed_at, r.expected_points
  FROM decision_import_runs r JOIN decision_documents d ON d.run_id = r.id
  WHERE r.completed_at IS NOT NULL AND d.session = '2025/26'
  ORDER BY upper(d.document_id), r.completed_at DESC, r.id DESC
), scoped AS MATERIALIZED (
  SELECT l.* FROM latest l JOIN report_catalog_entries c
  ON upper(c.document_id) = upper(l.document_id) WHERE c.run_id = $1
)`;

export async function readOverview(pool: Pool): Promise<Overview> {
  const client = await pool.connect();
  try {
    await client.query(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const result: Overview = {
      session: '2025/26',
      generatedAt: '',
      votes: null,
      decisions: null,
    };
    const votes =
      await client.query(`SELECT id, source_url, completed_at, event_count, expected_files
      FROM vote_import_runs WHERE session = '2025/26' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC LIMIT 1`);
    if (votes.rows[0]) {
      const v = votes.rows[0];
      const actual = await client.query(
        'SELECT count(*)::int AS count FROM vote_events WHERE run_id = $1',
        [v.id],
      );
      if (
        actual.rows[0].count !== v.event_count ||
        v.event_count !== v.expected_files
      )
        throw new Error('Incomplete overview vote snapshot');
      result.votes = {
        runId: v.id,
        sourceUrl: v.source_url,
        importedAt: v.completed_at.toISOString(),
        events: v.event_count,
        expectedEvents: v.expected_files,
      };
    }
    const catalogs =
      await client.query(`SELECT id, source_url, completed_at, expected_count
      FROM report_catalog_runs WHERE session = '2025/26' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC, id DESC LIMIT 1`);
    if (catalogs.rows[0]) {
      const c = catalogs.rows[0];
      const meta = (
        await client.query(
          `${scoped} SELECT count(*)::int AS reports,
        (SELECT count(*)::int FROM report_catalog_entries WHERE run_id = $1) AS source_reports,
        coalesce(sum(expected_points), 0)::int AS expected_points,
        count(*) FILTER (WHERE NOT coalesce(dated, false))::int AS undated,
        max(completed_at) AS latest_import FROM scoped`,
          [c.id],
        )
      ).rows[0];
      if (meta.source_reports !== c.expected_count)
        throw new Error('Incomplete overview catalog');
      const values = await client.query<{ value: string; count: number }>(
        `${scoped}
        SELECT p.decision_type AS value, count(*)::int AS count
        FROM scoped s JOIN decision_points p ON p.run_id = s.id
        GROUP BY p.decision_type ORDER BY p.decision_type`,
        [c.id],
      );
      const methods = { recordedVote: 0, acclamation: 0, other: 0, unknown: 0 };
      for (const row of values.rows) {
        const value = row.value.trim().toLocaleLowerCase('sv');
        if (value === 'röstning') methods.recordedVote += row.count;
        else if (value === 'acklamation') methods.acclamation += row.count;
        else if (value) methods.other += row.count;
        else methods.unknown += row.count;
      }
      const points = values.rows.reduce((sum, row) => sum + row.count, 0);
      if (points !== meta.expected_points)
        throw new Error('Incomplete overview decision snapshot');
      const recent = await client.query(
        `${scoped} SELECT document_id AS "documentId", designation,
        title, decision_date AS "decisionDate", source_url AS "sourceUrl", completed_at
        FROM scoped WHERE dated
        ORDER BY decision_date DESC, document_id LIMIT 3`,
        [c.id],
      );
      const gaps = await client.query(
        `WITH latest AS (
        SELECT DISTINCT ON (document_id) document_id, availability FROM decision_source_checks
        WHERE session = '2025/26' ORDER BY document_id, checked_at DESC, id DESC)
        SELECT count(*)::int AS count FROM latest l JOIN report_catalog_entries c
        ON upper(c.document_id) = l.document_id
        WHERE c.run_id = $1 AND l.availability = 'unavailable'`,
        [c.id],
      );
      result.decisions = {
        catalogRunId: c.id,
        sourceUrl: c.source_url,
        catalogImportedAt: c.completed_at.toISOString(),
        latestReportImportedAt: meta.latest_import?.toISOString() ?? null,
        reports: meta.reports,
        sourceReports: meta.source_reports,
        excludedReports: meta.source_reports - meta.reports,
        sourceGaps: gaps.rows[0].count,
        points,
        methods,
        sourceValues: values.rows,
        undatedReports: meta.undated,
        recent: recent.rows.map(({ completed_at, ...row }) => ({
          ...row,
          importedAt: completed_at.toISOString(),
        })),
      };
    }
    await client.query('COMMIT');
    result.generatedAt = new Date().toISOString();
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
