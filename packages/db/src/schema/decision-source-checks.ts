import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Verified source observations are not published decision snapshots.
export const decisionSourceChecks = pgTable(
  'decision_source_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: text('document_id').notNull(),
    session: text('session').notNull(),
    availability: text('availability').notNull(),
    reason: text('reason'),
    sourceUrl: text('source_url').notNull(),
    sourceHash: text('source_hash').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('decision_source_checks_document_idx').on(
      table.documentId,
      table.session,
      table.checkedAt,
    ),
  ],
);
