import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const importRuns = pgTable('import_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceUrl: text('source_url').notNull(),
  sourceDate: text('source_date').notNull(),
  expectedCount: integer('expected_count').notNull(),
  importedCount: integer('imported_count').notNull(),
  batchCount: integer('batch_count').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
});
