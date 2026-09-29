import { createDatabaseClient, importRuns, persons } from '@rikskollen/db';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';

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
