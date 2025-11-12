// // packages/api/src/db.ts
// import { createDatabaseClient } from '@rikskollen/db';
// import { politicians } from '@rikskollen/db';
// import { eq } from 'drizzle-orm';

// const { db } = createDatabaseClient();

// export const getAllPoliticians = async () => {
//   return db.select().from(politicians);
// };

// export const getPoliticianByRiksdagId = async (riksdagId: string) => {
//   const [row] = await db
//     .select()
//     .from(politicians)
//     .where(eq(politicians.riksdagId, riksdagId));

//   return row ?? null;
// };
