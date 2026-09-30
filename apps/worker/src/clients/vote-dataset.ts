import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import { workerEnv } from '@rikskollen/shared-types';

export const VOTE_SESSION = '2025/26';
export const VOTE_ARCHIVE_URL = '/dataset/votering/votering-202526.json.zip';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 300 * 1024 * 1024;
const MAX_FILES = 2_000;
const sourceRow = z
  .object({
    rm: z.string(),
    beteckning: z.string(),
    punkt: z.string(),
    votering_id: z.uuid(),
    intressent_id: z.string().min(1),
    namn: z.string(),
    parti: z.string(),
    valkrets: z.string(),
    rost: z.string().min(1),
    avser: z.string(),
    votering: z.string(),
    datum: z.string().nullable(),
  })
  .passthrough();
const voteFile = z.object({
  dokvotering: z.object({ votering: z.array(sourceRow).min(1) }),
});

export type ParsedVote = ReturnType<typeof parseVoteFile>;
export function archiveUrl() {
  return new URL(VOTE_ARCHIVE_URL, workerEnv().RIKSDAG_API_URL).toString();
}

export async function downloadVoteArchive(
  url = archiveUrl(),
): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Vote archive HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_ARCHIVE_BYTES)
    throw new Error('Vote archive exceeds size limit');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_ARCHIVE_BYTES)
    throw new Error('Vote archive exceeds size limit');
  return bytes;
}

export function readVoteArchive(bytes: Uint8Array) {
  if (bytes.length > MAX_ARCHIVE_BYTES)
    throw new Error('Vote archive exceeds size limit');
  let expandedBytes = 0,
    declaredFiles = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      if (
        !entry.name.endsWith('.json') ||
        entry.name.includes('/') ||
        entry.name.includes('\\')
      )
        throw new Error(`Unexpected archive entry: ${entry.name}`);
      expandedBytes += entry.originalSize;
      declaredFiles++;
      if (expandedBytes > MAX_EXPANDED_BYTES || declaredFiles > MAX_FILES)
        throw new Error('Vote archive expanded size limit exceeded');
      return true;
    },
  });
  const names = Object.keys(files).sort();
  if (
    names.length !== declaredFiles ||
    names.length === 0 ||
    names.reduce((size, name) => size + files[name].byteLength, 0) >
      MAX_EXPANDED_BYTES
  )
    throw new Error('Incomplete, empty or oversized vote archive');
  return {
    files,
    names,
    archiveHash: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function parseVoteFile(
  filename: string,
  bytes: Uint8Array,
  sourceArchiveUrl: string,
) {
  const rows = voteFile.parse(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
  ).dokvotering.votering;
  const first = rows[0];
  const suffix = `-${first.punkt}-${first.votering_id}.json`;
  if (!filename.toLowerCase().endsWith(suffix.toLowerCase()))
    throw new Error(`Vote filename does not match its rows: ${filename}`);
  const fileDocumentId = filename.slice(0, -suffix.length);
  // The three numbered ceremonial records in this dataset have no verifiable
  // document ID in the ZIP; do not manufacture one from the filename.
  const documentId = /^HD01[A-ZÅÄÖ]/.test(fileDocumentId)
    ? fileDocumentId
    : null;
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      row.rm !== VOTE_SESSION ||
      row.votering_id !== first.votering_id ||
      row.beteckning !== first.beteckning ||
      row.punkt !== first.punkt ||
      row.avser !== first.avser ||
      row.votering !== first.votering ||
      row.datum !== first.datum ||
      seen.has(row.intressent_id)
    )
      throw new Error(`Inconsistent or duplicate vote row: ${filename}`);
    seen.add(row.intressent_id);
  }
  if (rows.length !== 349)
    throw new Error(`Unexpected member row count ${rows.length}: ${filename}`);
  return {
    event: {
      voteId: first.votering_id.toLowerCase(),
      session: first.rm,
      designation: first.beteckning,
      proposalPoint: first.punkt,
      documentId,
      subjectType: first.avser,
      mainVoteType: first.votering,
      voteDate: first.datum,
      sourceFile: filename,
      sourceUrl: `https://data.riksdagen.se/votering/${first.votering_id}`,
      sourceHash: createHash('sha256').update(bytes).digest('hex'),
    },
    choices: rows.map((row) => ({
      voteId: first.votering_id.toLowerCase(),
      personId: row.intressent_id,
      sourceName: row.namn,
      partyCode: row.parti,
      constituency: row.valkrets,
      choice: row.rost,
    })),
    archiveUrl: sourceArchiveUrl,
  };
}
