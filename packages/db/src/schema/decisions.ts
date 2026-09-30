import { foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Each import is a complete version of one committee report's status record.
export const decisionImportRuns = pgTable('decision_import_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: text('document_id').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceHash: text('source_hash').notNull(),
  expectedPoints: integer('expected_points').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [index('decision_runs_document_idx').on(table.documentId, table.completedAt)]);

export const decisionDocuments = pgTable('decision_documents', {
  runId: uuid('run_id').primaryKey().references(() => decisionImportRuns.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull(),
  session: text('session').notNull(),
  designation: text('designation').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  decisionDate: text('decision_date'),
});

export const decisionPoints = pgTable('decision_points', {
  runId: uuid('run_id').notNull(),
  point: text('point').notNull(),
  heading: text('heading').notNull(),
  proposalText: text('proposal_text').notNull(),
  decisionType: text('decision_type').notNull(),
  winner: text('winner'),
  sourceVoteId: uuid('source_vote_id'),
}, (table) => [
  primaryKey({ columns: [table.runId, table.point] }),
  foreignKey({ columns: [table.runId], foreignColumns: [decisionDocuments.runId] }).onDelete('cascade'),
]);
