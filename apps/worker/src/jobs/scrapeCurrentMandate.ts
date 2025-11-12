// packages/worker/src/jobs/scrapeCurrentMandate.ts
import { upsertPolitician, upsertAttendance } from '@rikskollen/db/attendance';
import { fetchPoliticiansForMandate, fetchAttendanceForPolitician } from '@rikskollen/api';

export const scrapeCurrentMandate = async (): Promise<void> => {
  const mandatePeriod = '2022-2026'; // later make this configurable

  const politicians = await fetchPoliticiansForMandate(mandatePeriod);

  for (const politician of politicians) {
    await upsertPolitician(politician);

    // You probably want some pagination / date windowing here
    const attendanceRecords = await fetchAttendanceForPolitician(politician.riksdagId, {
      from: new Date('2022-09-01'),
      to: new Date(),
    });

    for (const record of attendanceRecords) {
      await upsertAttendance(record);
    }
  }
};
