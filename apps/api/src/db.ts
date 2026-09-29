import { createDatabaseClient, persons } from '@rikskollen/db';
import { eq } from 'drizzle-orm';

const { db, pgPool } = createDatabaseClient();

export const getAllPoliticians = async () => {
  return db.select().from(persons);
};

export const getPoliticianByRiksdagId = async (riksdagId: string) => {
  const [row] = await db
    .select()
    .from(persons)
    .where(eq(persons.personId, riksdagId));

  return row ?? null;
};

export const closeDatabase = () => pgPool.end();
