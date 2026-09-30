import { createHash } from 'node:crypto';
import { z } from 'zod';

const pointSchema = z.object({
  punkt: z.string().min(1),
  rubrik: z.string(),
  forslag: z.string(),
  beslutstyp: z.string(),
  vinnare: z.string().optional(),
  votering_id: z.string(),
});
const sourceSchema = z.object({
  dokumentstatus: z.object({
    dokument: z.object({
      dok_id: z.string(),
      rm: z.string(),
      beteckning: z.string(),
      titel: z.string(),
      status: z.string(),
      doktyp: z.literal('bet'),
    }),
    dokutskottsforslag: z.object({
      utskottsforslag: z.union([pointSchema, z.array(pointSchema)]),
    }),
    dokuppgift: z.object({
      uppgift: z.union([
        z.object({ kod: z.string(), text: z.string() }).passthrough(),
        z.array(z.object({ kod: z.string(), text: z.string() }).passthrough()),
      ]),
    }).optional(),
  }),
});

export const documentIdSchema = z.string().regex(/^HD01[A-Za-zÅÄÖåäö]{1,4}\d{1,3}$/);
const uuidSchema = z.uuid();

export function decisionStatusUrl(documentId: string) {
  return `https://data.riksdagen.se/dokumentstatus/${documentId}.json`;
}

export async function downloadDecisionStatus(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const size = Number(response.headers.get('content-length'));
  if (size > 16_000_000) throw new Error('Document status exceeds 16 MB');
  const raw = await response.text();
  if (Buffer.byteLength(raw) > 16_000_000) throw new Error('Document status exceeds 16 MB');
  return raw;
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

// The source embeds presentation HTML. Store plain text and render it only as text.
function plainText(html: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return html.replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const number = entity[1]?.toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number) : match;
    }
    return entities[entity.toLowerCase()] ?? match;
  }).replace(/\s+/g, ' ').trim();
}

export function parseDecisionStatus(raw: string, requestedId: string) {
  const id = documentIdSchema.parse(requestedId);
  const source = sourceSchema.parse(JSON.parse(raw)).dokumentstatus;
  const document = source.dokument;
  if (document.dok_id.toUpperCase() !== id.toUpperCase() || document.rm !== '2025/26')
    throw new Error(`Unexpected document ${document.dok_id} / ${document.rm}`);
  const items = asArray(source.dokutskottsforslag.utskottsforslag);
  if (!items.length) throw new Error('Document has no proposal points');
  const seen = new Set<string>();
  const points = items.map((item) => {
    if (seen.has(item.punkt)) throw new Error(`Duplicate proposal point ${item.punkt}`);
    seen.add(item.punkt);
    const voteId = item.votering_id.trim();
    if (voteId && !uuidSchema.safeParse(voteId).success)
      throw new Error(`Invalid vote ID for point ${item.punkt}`);
    if (item.beslutstyp.toLowerCase() === 'acklamation' && voteId)
      throw new Error(`Acclamation point ${item.punkt} has a vote ID`);
    return {
      point: item.punkt,
      heading: item.rubrik,
      proposalText: plainText(item.forslag),
      decisionType: item.beslutstyp,
      winner: item.vinnare || null,
      sourceVoteId: voteId ? voteId.toLowerCase() : null,
    };
  });
  const decisionDate = source.dokuppgift
    ? asArray(source.dokuppgift.uppgift).find((item) => item.kod === 'beslutdatumtid')?.text.slice(0, 10) ?? null
    : null;
  return {
    sourceHash: createHash('sha256').update(raw).digest('hex'),
    document: {
      documentId: document.dok_id,
      session: document.rm,
      designation: document.beteckning,
      title: document.titel,
      status: document.status,
      decisionDate,
    },
    points,
  };
}
