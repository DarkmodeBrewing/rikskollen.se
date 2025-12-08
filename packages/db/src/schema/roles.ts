import { date, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  code: text('code').notNull().primaryKey(),
  namn: text('namn'),
  sort: integer('sort'),
});
