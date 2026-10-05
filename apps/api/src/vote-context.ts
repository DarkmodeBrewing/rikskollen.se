import type { createDatabaseClient } from '@rikskollen/db';
type Pool = ReturnType<typeof createDatabaseClient>['pgPool'];

interface ContextEvent {
  voteId: string;
  documentId: string | null;
  proposalPoint: string;
  session: string;
}
interface VoteContext {
  voteId: string;
  reportTitle: string | null;
  pointHeading: string | null;
  titleSourceUrl: string | null;
  titleImportedAt: Date | null;
  pointSourceUrl: string | null;
  pointImportedAt: Date | null;
}

/** Enrich one page in one query; never fetch source data from a read request. */
export async function withVoteContext<T extends ContextEvent>(
  pool: Pool,
  events: T[],
) {
  if (!events.length) return [];
  const result = await pool.query<VoteContext>(
    `
    WITH events AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb)
        AS e("voteId" text, "documentId" text, "proposalPoint" text, session text)
    )
    SELECT e."voteId", coalesce(nullif(trim(d.title), ''), nullif(trim(c.title), '')) AS "reportTitle",
      nullif(trim(p.heading), '') AS "pointHeading",
      CASE WHEN nullif(trim(d.title), '') IS NOT NULL THEN d.source_url ELSE c.source_url END AS "titleSourceUrl",
      CASE WHEN nullif(trim(d.title), '') IS NOT NULL THEN d.completed_at ELSE c.completed_at END AS "titleImportedAt",
      CASE WHEN p.heading IS NOT NULL THEN d.source_url END AS "pointSourceUrl",
      CASE WHEN p.heading IS NOT NULL THEN d.completed_at END AS "pointImportedAt"
    FROM events e
    LEFT JOIN LATERAL (
      SELECT doc.title, r.id, r.source_url, r.completed_at
      FROM decision_import_runs r JOIN decision_documents doc ON doc.run_id = r.id
      WHERE upper(r.document_id) = upper(e."documentId") AND doc.session = e.session
        AND r.completed_at IS NOT NULL
      ORDER BY r.completed_at DESC, r.id DESC LIMIT 1
    ) d ON true
    LEFT JOIN decision_points p ON p.run_id = d.id AND p.point = e."proposalPoint"
      AND p.source_vote_id::text = e."voteId"
    LEFT JOIN LATERAL (
      SELECT entry.title, r.source_url, r.completed_at
      FROM report_catalog_entries entry JOIN (
        SELECT * FROM report_catalog_runs WHERE session = e.session AND completed_at IS NOT NULL
        ORDER BY completed_at DESC, id DESC LIMIT 1
      ) r ON r.id = entry.run_id
      WHERE upper(entry.document_id) = upper(e."documentId")
    ) c ON true
  `,
    [
      JSON.stringify(
        events.map(({ voteId, documentId, proposalPoint, session }) => ({
          voteId,
          documentId,
          proposalPoint,
          session,
        })),
      ),
    ],
  );
  const byVote = new Map(
    result.rows.map(({ voteId, ...context }) => [voteId, context]),
  );
  return events.map((event) => ({
    ...event,
    context: byVote.get(event.voteId)!,
  }));
}
