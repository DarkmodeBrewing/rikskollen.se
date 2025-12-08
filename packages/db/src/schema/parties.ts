import { relations } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { persons } from './persons';

export const parties = pgTable('parties', {
  code: text('code').notNull().primaryKey(),
  colorHex: text('color_hex').notNull(),
});

export const partyRelations = relations(parties, ({ many }) => ({
  persons: many(persons),
}));
