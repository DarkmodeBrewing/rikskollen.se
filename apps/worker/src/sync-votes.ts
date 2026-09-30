import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import {
  createDatabaseClient,
  voteChoices,
  voteEvents,
  voteImportRuns,
} from '@rikskollen/db';
import {
  archiveUrl,
  downloadVoteArchive,
  parseVoteFile,
  readVoteArchive,
  VOTE_SESSION,
} from './clients/vote-dataset';

export async function syncVotes(loadArchive = downloadVoteArchive) {
  const url = archiveUrl();
  const bytes = await loadArchive(url);
  const { files, names, archiveHash } = readVoteArchive(bytes);
  const { db, pgPool } = createDatabaseClient();
  let runId: string | undefined;
  try {
    const [run] = await db
      .insert(voteImportRuns)
      .values({
        session: VOTE_SESSION,
        sourceUrl: url,
        sourceHash: archiveHash,
        expectedFiles: names.length,
      })
      .returning();
    runId = run.id;
    let eventCount = 0,
      choiceCount = 0;
    const seen = new Set<string>();
    for (const filename of names) {
      const { event, choices } = parseVoteFile(filename, files[filename], url);
      if (seen.has(event.voteId))
        throw new Error(`Duplicate vote ID ${event.voteId}`);
      seen.add(event.voteId);
      await db.transaction(async (tx) => {
        await tx.insert(voteEvents).values({ ...event, runId: run.id });
        await tx
          .insert(voteChoices)
          .values(choices.map((choice) => ({ ...choice, runId: run.id })));
      });
      eventCount++;
      choiceCount += choices.length;
    }
    if (eventCount !== names.length || choiceCount !== eventCount * 349)
      throw new Error('Vote archive reconciliation failed');
    await db
      .update(voteImportRuns)
      .set({ eventCount, choiceCount, completedAt: new Date() })
      .where(eq(voteImportRuns.id, run.id));
    return {
      runId: run.id,
      session: VOTE_SESSION,
      eventCount,
      choiceCount,
      archiveHash,
    };
  } catch (error) {
    if (runId)
      await db.delete(voteImportRuns).where(eq(voteImportRuns.id, runId));
    throw error;
  } finally {
    await pgPool.end();
  }
}

if (
  process.argv[1]?.endsWith('sync-votes.js') ||
  process.argv[1]?.endsWith('sync-votes.ts')
) {
  const archivePath = process.argv[2];
  syncVotes(
    archivePath
      ? async () => new Uint8Array(await readFile(archivePath))
      : downloadVoteArchive,
  )
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
