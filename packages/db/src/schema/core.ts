import {
  pgTable,
  serial,
  text,
  date,
  timestamp,
  uuid,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core';

import { z } from 'zod';

// --- enums ---

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'absent',
  'leave',
  'unknown',
]);

// --- mandate_periods ---

export const mandatePeriods = pgTable('mandate_periods', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // '2018-2022'
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
});

// --- parties ---

export const parties = pgTable('parties', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // 'S', 'M'
  name: text('name').notNull(),
  colorHex: text('color_hex'),
});

// --- constituencies ---

export const constituencies = pgTable('constituencies', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
});

// --- politicians ---
export const politicians = pgTable('politicians', {
  id: uuid('id').defaultRandom().primaryKey(),
  riksdagId: text('riksdag_id').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  fullName: text('full_name').notNull(),
  partyId: integer('party_id').references(() => parties.id),
  constituencyId: integer('constituency_id').references(
    () => constituencies.id,
  ),
  activeFrom: date('active_from'),
  activeTo: date('active_to'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- sessions ---

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  riksdagId: text('riksdag_id').unique(),
  date: date('date').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'plenum', 'votering', etc.
  mandatePeriodId: integer('mandate_period_id').references(
    () => mandatePeriods.id,
  ),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- attendance ---

export const attendance = pgTable('attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  politicianId: uuid('politician_id')
    .notNull()
    .references(() => politicians.id),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  status: attendanceStatusEnum('status').notNull(),
  sourceUrl: text('source_url').notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }),
  scrapedAt: timestamp('scraped_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // drizzle can't declare composite unique in column definition,
  // we'll add that in a separate constraint config if needed
});
