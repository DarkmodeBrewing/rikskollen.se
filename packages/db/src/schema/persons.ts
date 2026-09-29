import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';

export const persons = pgTable('persons', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: text('person_id').notNull().unique(),
  sourceId: uuid('sourceid').notNull().unique(),
  givenName: text('given_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender'),
  birthYear: integer('birth_year'),
  status: text('status'),
  personUrl: text('person_url'),
  imageMax: text('image_max'),
  partyCode: text('party_code').notNull(),
  constituency: text('constituency').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceHash: text('source_hash').notNull().default(''),
  assignments: jsonb('assignments')
    .$type<
      Array<{
        organCode: string;
        roleCode: string;
        kind: string;
        status: string | null;
        from: string | null;
        to: string | null;
        value: string | null;
        order: number;
      }>
    >()
    .notNull()
    .default([]),
  importRunId: uuid('import_run_id'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
