// packages/worker/src/jobs/upsertAttendance.ts
import { createDatabaseClient } from '@rikskollen/db';
import {
  attendance,
  attendanceStatusEnum,
  sessions,
  politicians
} from '@rikskollen/db/schema/core';
import { eq, and } from 'drizzle-orm';

const { db } = createDatabaseClient();

export interface ScrapedAttendanceRecord {
  politicianRiksdagId: string;
  sessionRiksdagId: string;
  status: 'present' | 'absent' | 'leave' | 'unknown';
  sourceUrl: string;
  reportedAt?: Date;
}

/**
 * Upsert a single attendance record based on riksdag IDs.
 * Assumes politician + session have already been upserted.
 */
export const upsertAttendanceRecord = async (
  record: ScrapedAttendanceRecord
): Promise<void> => {
  // Resolve politician + session IDs
  const [politicianRow] = await db
    .select({ id: politicians.id })
    .from(politicians)
    .where(eq(politicians.riksdagId, record.politicianRiksdagId));

  const [sessionRow] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.riksdagId, record.sessionRiksdagId));

  if (!politicianRow || !sessionRow) {
    // Later you might want better logging here
    console.warn(
      'Missing politician or session for attendance',
      record
    );
    return;
  }

  const [existing] = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(
      and(
        eq(attendance.politicianId, politicianRow.id),
        eq(attendance.sessionId, sessionRow.id)
      )
    );

  if (existing) {
    // Update existing record
    await db
      .update(attendance)
      .set({
        status: record.status,
        sourceUrl: record.sourceUrl,
        reportedAt: record.reportedAt,
        scrapedAt: new Date()
      })
      .where(eq(attendance.id, existing.id));
  } else {
    // Insert new record
    await db.insert(attendance).values({
      politicianId: politicianRow.id,
      sessionId: sessionRow.id,
      status: record.status,
      sourceUrl: record.sourceUrl,
      reportedAt: record.reportedAt
    });
  }
};
