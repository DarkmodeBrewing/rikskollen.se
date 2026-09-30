import { createDatabaseClient, reportCatalogEntries, reportCatalogPages, reportCatalogRuns } from '@rikskollen/db';
import { eq } from 'drizzle-orm';
import { collectReportCatalog, downloadReportCatalogPage, REPORT_SESSION } from './clients/report-catalog';

export async function syncReportCatalog(load = downloadReportCatalogPage) {
  // Fetch and reconcile before writing any run; a failed page leaves the
  // previously completed catalog untouched.
  const snapshot = await collectReportCatalog(load);
  const { db, pgPool } = createDatabaseClient();
  try {
    return await db.transaction(async (tx) => {
      const [run] = await tx.insert(reportCatalogRuns).values({
        session: REPORT_SESSION,
        sourceUrl: snapshot.sourceUrl,
        sourceHash: snapshot.sourceHash,
        expectedCount: snapshot.expectedCount,
        pageCount: snapshot.pageCount,
      }).returning();
      await tx.insert(reportCatalogPages).values(snapshot.pages.map((page) => ({ ...page, runId: run.id })));
      await tx.insert(reportCatalogEntries).values(snapshot.entries.map((entry) => ({ ...entry, runId: run.id })));
      await tx.update(reportCatalogRuns).set({ completedAt: new Date() }).where(eq(reportCatalogRuns.id, run.id));
      return { runId: run.id, documentCount: snapshot.expectedCount, pageCount: snapshot.pageCount, sourceHash: snapshot.sourceHash };
    });
  } finally {
    await pgPool.end();
  }
}

if (process.argv[1]?.endsWith('sync-report-catalog.js') || process.argv[1]?.endsWith('sync-report-catalog.ts')) {
  syncReportCatalog().then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
