import { date, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const mandatePeriods = pgTable('mandate_periods', {
  code: text('code').notNull().primaryKey(),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
});
