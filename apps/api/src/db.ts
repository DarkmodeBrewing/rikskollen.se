import { createDatabaseClient } from '@rikskollen/db';
import { persons } from '@rikskollen/db';
import { eq } from 'drizzle-orm';


export const getAllPoliticians = async () => {
  return db.select().from(persons);
};

export const getPoliticianByRiksdagId = async (riksdagId: string) => {
  const [row] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.riksdagId, riksdagId));

  return row ?? null;
};
