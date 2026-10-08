import {
  recordImportAttempt,
  type AttemptProgress,
} from './lib/import-attempt';
import { createHash } from 'node:crypto';
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

export async function syncVotes(
  loadArchive = downloadVoteArchive,
  onlyChanged = false,
) {
  return recordImportAttempt(
    { dataset: 'votes', job: 'votes', session: '2025/26' },
    (progress) => executeSyncVotes(loadArchive, progress, onlyChanged),
    (result) => ({
      importedCount: result.unchanged ? 0 : result.eventCount,
      unchanged: result.unchanged,
      snapshotId: result.runId,
    }),
  );
}

async function executeSyncVotes(
  loadArchive = downloadVoteArchive,
  progress: AttemptProgress,
  onlyChanged: boolean,
) {
  const url = archiveUrl();
  const bytes = await loadArchive(url);
  const { files, names, archiveHash } = readVoteArchive(bytes);
  await progress.expected(names.length);
  const { db, pgPool } = createDatabaseClient();
  let runId: string | undefined;
  try {
    if (onlyChanged) {
      const previous = await pgPool.query<{
        id: string;
        expected_files: number;
        event_count: number;
        choice_count: number;
        actual: number;
        choices: number;
      }>(
        `
        SELECT r.*, (SELECT count(*)::int FROM vote_events WHERE run_id = r.id) AS actual,
          (SELECT count(*)::int FROM vote_choices WHERE run_id = r.id) AS choices
        FROM vote_import_runs r WHERE session = $1 AND completed_at IS NOT NULL
        ORDER BY completed_at DESC, id DESC LIMIT 1`,
        [VOTE_SESSION],
      );
      const run = previous.rows[0];
      if (
        run &&
        run.expected_files === names.length &&
        run.event_count === names.length &&
        run.actual === names.length &&
        run.choice_count === names.length * 349 &&
        run.choices === run.choice_count
      ) {
        const events = await pgPool.query<{
          source_file: string;
          source_hash: string;
        }>(
          'SELECT source_file, source_hash FROM vote_events WHERE run_id = $1',
          [run.id],
        );
        const hashes = new Map(
          events.rows.map((e) => [e.source_file, e.source_hash]),
        );
        // ZIP metadata can change every day without a single source row changing.
        if (
          names.every(
            (name) =>
              hashes.get(name) ===
              createHash('sha256').update(files[name]).digest('hex'),
          )
        ) {
          return {
            runId: run.id,
            session: VOTE_SESSION,
            eventCount: names.length,
            choiceCount: run.choice_count,
            archiveHash,
            unchanged: true,
          };
        }
      }
    }
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
      unchanged: false,
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
