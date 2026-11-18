import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ParsedVote } from './vote-dataset';

const MAX_BYTES = 256 * 1024;
const documentSchema = z.object({
  votering: z.object({ dokument: z.object({
    sourceid: z.uuid(), rm: z.string(), beteckning: z.string(),
    tempbeteckning: z.string(), doktyp: z.literal('votering'),
    titel: z.string().trim().min(1), datum: z.string(),
  }) }),
});
export function voteDetailUrl(voteId: string) {
  return `https://data.riksdagen.se/votering/${z.uuid().parse(voteId).toLowerCase()}/json`;
}
export function parseVoteDetail(raw: string, event: ParsedVote['event']) {
  if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('Vote detail exceeds size limit');
  const doc = documentSchema.parse(JSON.parse(raw)).votering.dokument;
  if (doc.sourceid.toLowerCase() !== event.voteId || doc.rm !== event.session ||
      doc.beteckning !== event.designation || doc.tempbeteckning !== event.proposalPoint)
    throw new Error('Vote detail identity mismatch');
  const date = doc.datum.match(/^(\d{4}-\d{2}-\d{2}) 00:00:00$/)?.[1];
  if (!date || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)
    throw new Error('Invalid vote detail date');
  if (event.voteDate && event.voteDate !== date) throw new Error('Conflicting vote dates');
  return {
    detailTitle: doc.titel, detailDate: date,
    detailSourceUrl: voteDetailUrl(event.voteId),
    detailSourceHash: createHash('sha256').update(raw).digest('hex'),
    detailFetchedAt: new Date(),
  };
}
export async function downloadVoteDetail(event: ParsedVote['event']) {
  const response = await fetch(voteDetailUrl(event.voteId), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Vote detail HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Vote detail exceeds size limit');
  if (!response.body) throw new Error('Empty vote detail response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error('Vote detail exceeds size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return parseVoteDetail(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), event);
}
