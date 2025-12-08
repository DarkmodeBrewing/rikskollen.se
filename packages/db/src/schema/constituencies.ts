import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const constituencies = pgTable('constituencies', {
  code: text('code').notNull().primaryKey(),
  name: text('name').notNull(),
});
