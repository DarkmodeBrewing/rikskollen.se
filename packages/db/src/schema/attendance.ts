import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { persons } from './persons';
import { sessions } from './sessions';

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'absent',
  'leave',
  'unknown',
]);

export const attendance = pgTable('attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  politicianId: uuid('politician_id')
    .notNull()
    .references(() => persons.id),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  status: attendanceStatusEnum('status').notNull(),
  sourceUrl: text('source_url').notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }),
  scrapedAt: timestamp('scraped_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
