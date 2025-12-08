import { date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { mandatePeriods } from './mandate-period';
import { relations } from 'drizzle-orm';

// Riksmöte

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  riksdagId: text('riksdag_id').unique(),
  date: date('date').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'plenum', 'votering', etc.
  mandatePeriodCode: text('mandate_period_id').references(
    () => mandatePeriods.code,
  ),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionRelations = relations(sessions, ({ one }) => ({
  mandatePeriods: one(mandatePeriods, {
    fields: [sessions.mandatePeriodCode],
    references: [mandatePeriods.code],
  }),
}));
