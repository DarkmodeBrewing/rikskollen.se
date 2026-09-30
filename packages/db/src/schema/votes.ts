import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const voteImportRuns = pgTable('vote_import_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  session: text('session').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceHash: text('source_hash').notNull(),
  expectedFiles: integer('expected_files').notNull(),
  eventCount: integer('event_count').notNull().default(0),
  choiceCount: integer('choice_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const voteEvents = pgTable(
  'vote_events',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => voteImportRuns.id, { onDelete: 'cascade' }),
    voteId: uuid('vote_id').notNull(),
    session: text('session').notNull(),
    designation: text('designation').notNull(),
    proposalPoint: text('proposal_point').notNull(),
    documentId: text('document_id'),
    subjectType: text('subject_type').notNull(),
    mainVoteType: text('main_vote_type').notNull(),
    voteDate: text('vote_date'),
    sourceFile: text('source_file').notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceHash: text('source_hash').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.voteId] }),
    index('vote_events_run_date_idx').on(table.runId, table.voteDate),
  ],
);

export const voteChoices = pgTable(
  'vote_choices',
  {
    runId: uuid('run_id').notNull(),
    voteId: uuid('vote_id').notNull(),
    personId: text('person_id').notNull(),
    sourceName: text('source_name').notNull(),
    partyCode: text('party_code').notNull(),
    constituency: text('constituency').notNull(),
    choice: text('choice').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.voteId, table.personId] }),
    index('vote_choices_run_person_idx').on(table.runId, table.personId),
    foreignKey({
      columns: [table.runId, table.voteId],
      foreignColumns: [voteEvents.runId, voteEvents.voteId],
    }).onDelete('cascade'),
  ],
);
