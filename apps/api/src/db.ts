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
