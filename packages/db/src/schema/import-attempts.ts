import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Operational attempts are independent of published data snapshots: even a
// fetch failure before a transaction begins must remain visible.
export const importAttempts = pgTable(
  'import_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dataset: text('dataset').notNull(),
    job: text('job').notNull(),
    session: text('session'),
    documentId: text('document_id'),
    status: text('status').notNull().default('running'),
    expectedCount: integer('expected_count'),
    importedCount: integer('imported_count').notNull().default(0),
    snapshotId: uuid('snapshot_id'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('import_attempts_started_idx').on(table.startedAt),
    index('import_attempts_job_idx').on(table.job, table.startedAt),
  ],
);
