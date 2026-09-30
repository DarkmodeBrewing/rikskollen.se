import {
  createDatabaseClient,
  importRuns,
  persons,
  voteChoices,
  voteEvents,
  voteImportRuns,
  decisionDocuments,
  decisionImportRuns,
  decisionPoints,
  reportCatalogRuns,
} from '@rikskollen/db';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from 'drizzle-orm';

const { db, pgPool } = createDatabaseClient();

export async function listPersons(query: string, page: number, limit: number) {
  const term = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const [run] = await db
    .select({ id: importRuns.id })
    .from(importRuns)
    .orderBy(desc(importRuns.completedAt))
    .limit(1);
  if (!run) return { items: [], total: 0, page, limit };
  const search = query
    ? or(
        ilike(persons.givenName, term),
        ilike(persons.lastName, term),
        ilike(persons.partyCode, term),
        ilike(persons.constituency, term),
      )
    : undefined;
  const where = and(eq(persons.importRunId, run.id), search);
  const [total] = await db
    .select({ count: count() })
    .from(persons)
    .where(where);
  const items = await db
    .select()
    .from(persons)
    .where(where)
    .orderBy(
      asc(persons.lastName),
      asc(persons.givenName),
      asc(persons.personId),
    )
    .limit(limit)
    .offset((page - 1) * limit);
  return { items, total: total.count, page, limit };
}
export async function getPerson(id: string) {
  const [run] = await db
    .select({ id: importRuns.id })
    .from(importRuns)
    .orderBy(desc(importRuns.completedAt))
    .limit(1);
  if (!run) return null;
  const [row] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.personId, id), eq(persons.importRunId, run.id)));
  return row ?? null;
}
export async function getImportStatus() {
  const [run] = await db
    .select()
    .from(importRuns)
    .orderBy(desc(importRuns.completedAt))
    .limit(1);
  if (!run) return null;
  const [coverage] = await db
    .select({ count: count() })
    .from(persons)
    .where(eq(persons.importRunId, run.id));
  return {
    ...run,
    currentCount: coverage.count,
    complete:
      coverage.count === run.expectedCount &&
      run.importedCount === run.expectedCount,
  };
}
export const closeDatabase = () => pgPool.end();

// Vote rows are scoped to the most recent completed session snapshot.
export async function getVoteRun(session = '2025/26') {
  const [run] = await db
    .select()
    .from(voteImportRuns)
    .where(
      and(
        eq(voteImportRuns.session, session),
        isNotNull(voteImportRuns.completedAt),
      ),
    )
    .orderBy(desc(voteImportRuns.completedAt))
    .limit(1);
  return run ?? null;
}
export async function listVotes(page: number, limit: number) {
  const run = await getVoteRun();
  if (!run) return { items: [], total: 0, page, limit, session: '2025/26' };
  const [total] = await db
    .select({ count: count() })
    .from(voteEvents)
    .where(eq(voteEvents.runId, run.id));
  const items = await db
    .select()
    .from(voteEvents)
    .where(eq(voteEvents.runId, run.id))
    .orderBy(
      desc(voteEvents.voteDate),
      asc(voteEvents.designation),
      asc(voteEvents.proposalPoint),
    )
    .limit(limit)
    .offset((page - 1) * limit);
  return { items, total: total.count, page, limit, session: run.session };
}
export async function getVote(voteId: string) {
  const run = await getVoteRun();
  if (!run) return null;
  const [event] = await db
    .select()
    .from(voteEvents)
    .where(and(eq(voteEvents.runId, run.id), eq(voteEvents.voteId, voteId)));
  if (!event) return null;
  const decisionTrailAvailable = event.documentId
    ? !!(await db.select({ id: decisionImportRuns.id }).from(decisionImportRuns)
        .where(and(sql`upper(${decisionImportRuns.documentId}) = upper(${event.documentId})`, isNotNull(decisionImportRuns.completedAt)))
        .limit(1))[0]
    : false;
  const choices = await db
    .select()
    .from(voteChoices)
    .where(and(eq(voteChoices.runId, run.id), eq(voteChoices.voteId, voteId)))
    .orderBy(asc(voteChoices.sourceName), asc(voteChoices.personId));
  const [memberRun] = await db
    .select({ id: importRuns.id })
    .from(importRuns)
    .orderBy(desc(importRuns.completedAt))
    .limit(1);
  const available = memberRun
    ? await db
        .select({ personId: persons.personId })
        .from(persons)
        .where(
          and(
            eq(persons.importRunId, memberRun.id),
            inArray(
              persons.personId,
              choices.map((row) => row.personId),
            ),
          ),
        )
    : [];
  const profileIds = new Set(available.map((row) => row.personId));
  const counts = Object.fromEntries(
    Object.entries(
      choices.reduce<Record<string, number>>((result, row) => {
        result[row.choice] = (result[row.choice] ?? 0) + 1;
        return result;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b, 'sv')),
  );
  return {
    event,
    decisionTrailAvailable,
    choices: choices.map((choice) => ({
      ...choice,
      memberProfileAvailable: profileIds.has(choice.personId),
    })),
    counts,
    total: choices.length,
    sourceArchiveUrl: run.sourceUrl,
    importedAt: run.completedAt,
  };
}

export async function getDecisionTrail(documentId: string) {
  const [run] = await db.select().from(decisionImportRuns)
    .where(and(sql`upper(${decisionImportRuns.documentId}) = upper(${documentId})`, isNotNull(decisionImportRuns.completedAt)))
    .orderBy(desc(decisionImportRuns.completedAt)).limit(1);
  if (!run) return null;
  const [document] = await db.select().from(decisionDocuments).where(eq(decisionDocuments.runId, run.id));
  const points = await db.select().from(decisionPoints).where(eq(decisionPoints.runId, run.id))
    .orderBy(sql`case when ${decisionPoints.point} ~ '^[0-9]+$' then ${decisionPoints.point}::integer else 2147483647 end`, asc(decisionPoints.point));
  if (!document || points.length !== run.expectedPoints)
    throw new Error(`Incomplete decision import ${run.id}`);
  const voteRun = await getVoteRun(document.session);
  const voteRows = voteRun
    ? await db.select({ voteId: voteEvents.voteId, proposalPoint: voteEvents.proposalPoint })
        .from(voteEvents).where(and(eq(voteEvents.runId, voteRun.id), sql`upper(${voteEvents.documentId}) = upper(${documentId})`))
    : [];
  const verifiedVotes = new Set(voteRows.map((row) => `${row.proposalPoint}:${row.voteId}`));
  return {
    document,
    points: points.map((point) => ({ ...point, localVoteAvailable: !!point.sourceVoteId && verifiedVotes.has(`${point.point}:${point.sourceVoteId}`) })),
    sourceUrl: run.sourceUrl,
    sourceHash: run.sourceHash,
    importedAt: run.completedAt,
    expectedPoints: run.expectedPoints,
  };
}

export async function listDecisions(page: number, limit: number) {
  const latest = `WITH latest AS (
    SELECT DISTINCT ON (upper(document_id)) id, document_id, source_url, completed_at, expected_points
    FROM decision_import_runs WHERE completed_at IS NOT NULL
    ORDER BY upper(document_id), completed_at DESC, id DESC
  )`;
  const total = await pgPool.query<{ count: number }>(`${latest} SELECT count(*)::int AS count FROM latest`);
  const list = await pgPool.query<{
    documentId: string; session: string; designation: string; title: string;
    decisionDate: string | null; pointCount: number; sourceUrl: string; importedAt: Date;
  }>(`${latest} SELECT d.document_id AS "documentId", d.session, d.designation, d.title,
      d.decision_date AS "decisionDate", l.expected_points AS "pointCount",
      l.source_url AS "sourceUrl", l.completed_at AS "importedAt"
    FROM latest l JOIN decision_documents d ON d.run_id = l.id
    ORDER BY d.decision_date DESC NULLS LAST, d.designation, d.document_id
    LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit]);

  const voteRun = await getVoteRun();
  const [catalogRun] = await db.select().from(reportCatalogRuns)
    .where(and(eq(reportCatalogRuns.session, '2025/26'), isNotNull(reportCatalogRuns.completedAt)))
    .orderBy(desc(reportCatalogRuns.completedAt), desc(reportCatalogRuns.id)).limit(1);
  let catalogCoverage = null;
  let decisionMethodSummary = null;
  if (catalogRun) {
    const result = await pgPool.query<{
      sourceDocuments: number; importedDocuments: number; withRecordedVote: number | null;
    }>(`SELECT count(*)::int AS "sourceDocuments",
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM decision_import_runs d WHERE d.completed_at IS NOT NULL
        AND upper(d.document_id) = upper(c.document_id)))::int AS "importedDocuments",
      count(*) FILTER (WHERE $2::uuid IS NOT NULL AND EXISTS (
        SELECT 1 FROM vote_events v WHERE v.run_id = $2::uuid
        AND upper(v.document_id) = upper(c.document_id)))::int AS "withRecordedVote"
      FROM report_catalog_entries c WHERE c.run_id = $1`, [catalogRun.id, voteRun?.id ?? null]);
    if (result.rows[0].sourceDocuments !== catalogRun.expectedCount)
      throw new Error(`Incomplete report catalog ${catalogRun.id}`);
    catalogCoverage = {
      ...result.rows[0],
      withRecordedVote: voteRun ? result.rows[0].withRecordedVote : null,
      session: catalogRun.session,
      catalogRunId: catalogRun.id,
      catalogSourceUrl: catalogRun.sourceUrl,
      catalogCompletedAt: catalogRun.completedAt,
    };
    const scoped = `${latest}, scoped AS (
      SELECT l.id, l.expected_points FROM report_catalog_entries c
      JOIN latest l ON upper(l.document_id) = upper(c.document_id)
      JOIN decision_documents d ON d.run_id = l.id AND d.session = $1
      WHERE c.run_id = $2
    )`;
    const reports = await pgPool.query<{ importedDocuments: number; expectedPoints: number }>(
      `${scoped} SELECT count(*)::int AS "importedDocuments",
        coalesce(sum(expected_points), 0)::int AS "expectedPoints" FROM scoped`,
      [catalogRun.session, catalogRun.id]);
    const methods = await pgPool.query<{ sourceValue: string; count: number }>(
      `${scoped} SELECT p.decision_type AS "sourceValue", count(*)::int AS count
        FROM scoped s JOIN decision_points p ON p.run_id = s.id
        GROUP BY p.decision_type ORDER BY p.decision_type`,
      [catalogRun.session, catalogRun.id]);
    const importedDocuments = reports.rows[0].importedDocuments;
    const totalPoints = methods.rows.reduce((sum, row) => sum + row.count, 0);
    if (importedDocuments !== catalogCoverage.importedDocuments || totalPoints !== reports.rows[0].expectedPoints)
      throw new Error(`Incomplete decision summary for catalog ${catalogRun.id}`);
    const counts = { recordedVote: 0, acclamation: 0, other: 0, unknown: 0 };
    for (const row of methods.rows) {
      const value = row.sourceValue?.trim().toLocaleLowerCase('sv');
      if (value === 'röstning') counts.recordedVote += row.count;
      else if (value === 'acklamation') counts.acclamation += row.count;
      else if (!value) counts.unknown += row.count;
      else counts.other += row.count;
    }
    decisionMethodSummary = {
      session: catalogRun.session,
      sourceDocuments: catalogCoverage.sourceDocuments,
      importedDocuments,
      excludedDocuments: catalogCoverage.sourceDocuments - importedDocuments,
      totalPoints,
      counts,
      sourceValues: methods.rows,
      catalogSourceUrl: catalogRun.sourceUrl,
      catalogCompletedAt: catalogRun.completedAt,
    };
  }
  let coverage = null;
  if (voteRun) {
    const result = await pgPool.query<{
      sourceDocuments: number; importedDocuments: number; voteEventsWithoutDocument: number;
    }>(`SELECT
      (SELECT count(DISTINCT upper(document_id))::int FROM vote_events WHERE run_id = $1 AND document_id IS NOT NULL) AS "sourceDocuments",
      (SELECT count(DISTINCT upper(v.document_id))::int FROM vote_events v
        WHERE v.run_id = $1 AND v.document_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM decision_import_runs r WHERE r.completed_at IS NOT NULL
          AND upper(r.document_id) = upper(v.document_id))) AS "importedDocuments",
      (SELECT count(*)::int FROM vote_events WHERE run_id = $1 AND document_id IS NULL) AS "voteEventsWithoutDocument"`, [voteRun.id]);
    coverage = {
      ...result.rows[0],
      session: voteRun.session,
      voteRunId: voteRun.id,
      voteSourceUrl: voteRun.sourceUrl,
    };
  }
  return { items: list.rows, total: total.rows[0].count, page, limit, coverage, catalogCoverage, decisionMethodSummary };
}
export async function getMemberVotes(
  personId: string,
  page: number,
  limit: number,
) {
  const run = await getVoteRun();
  if (!run) return { items: [], total: 0, page, limit, session: '2025/26' };
  const where = and(
    eq(voteChoices.runId, run.id),
    eq(voteChoices.personId, personId),
  );
  const [total] = await db
    .select({ count: count() })
    .from(voteChoices)
    .where(where);
  const items = await db
    .select({ event: voteEvents, choice: voteChoices.choice })
    .from(voteChoices)
    .innerJoin(
      voteEvents,
      and(
        eq(voteChoices.runId, voteEvents.runId),
        eq(voteChoices.voteId, voteEvents.voteId),
      ),
    )
    .where(where)
    .orderBy(
      desc(voteEvents.voteDate),
      asc(voteEvents.designation),
      asc(voteEvents.proposalPoint),
    )
    .limit(limit)
    .offset((page - 1) * limit);
  return { items, total: total.count, page, limit, session: run.session };
}
export async function getVoteImportStatus() {
  const run = await getVoteRun();
  return run
    ? {
        ...run,
        complete:
          run.eventCount === run.expectedFiles &&
          run.choiceCount === run.eventCount * 349,
      }
    : null;
}
