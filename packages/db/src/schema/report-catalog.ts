import { foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const reportCatalogRuns = pgTable('report_catalog_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  session: text('session').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceHash: text('source_hash').notNull(),
  expectedCount: integer('expected_count').notNull(),
  pageCount: integer('page_count').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [index('report_catalog_runs_session_idx').on(table.session, table.completedAt)]);

export const reportCatalogPages = pgTable('report_catalog_pages', {
  runId: uuid('run_id').notNull().references(() => reportCatalogRuns.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceHash: text('source_hash').notNull(),
  itemCount: integer('item_count').notNull(),
}, (table) => [primaryKey({ columns: [table.runId, table.page] })]);

export const reportCatalogEntries = pgTable('report_catalog_entries', {
  runId: uuid('run_id').notNull(),
  documentId: text('document_id').notNull(),
  designation: text('designation').notNull(),
  title: text('title').notNull(),
  sourceDate: text('source_date'),
  page: integer('page').notNull(),
}, (table) => [
  primaryKey({ columns: [table.runId, table.documentId] }),
  foreignKey({ columns: [table.runId, table.page], foreignColumns: [reportCatalogPages.runId, reportCatalogPages.page] }).onDelete('cascade'),
]);
