import { createHash } from 'node:crypto';
import { z } from 'zod';
import { documentIdSchema } from './decision-status';

export const REPORT_SESSION = '2025/26';
export function reportCatalogUrl(page: number) {
  return `https://data.riksdagen.se/dokumentlista/?a=s&doktyp=bet&rm=2025/26&beslutad=1&utformat=json&sort=datum&sortorder=asc&p=${page}`;
}

const sourceEntry = z.object({
  dok_id: z.string(),
  rm: z.string(),
  doktyp: z.string(),
  beteckning: z.string(),
  titel: z.string(),
  datum: z.string().nullable().optional(),
  beslutad: z.string(),
});
const sourcePage = z.object({
  dokumentlista: z.object({
    '@sida': z.coerce.number().int().min(1),
    '@sidor': z.coerce.number().int().min(1),
    '@traffar': z.coerce.number().int().min(1),
    '@traff_fran': z.coerce.number().int().min(1),
    '@traff_till': z.coerce.number().int().min(1),
    '@nasta_sida': z.string().nullable().optional(),
    dokument: z.union([sourceEntry, z.array(sourceEntry)]),
  }),
});

export async function downloadReportCatalogPage(url: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
      }
      if (Number(response.headers.get('content-length')) > 5_000_000)
        throw new Error(`Oversized report list page: ${url}`);
      const raw = await response.text();
      if (Buffer.byteLength(raw) > 5_000_000)
        throw new Error(`Oversized report list page: ${url}`);
      return raw;
    } catch (error) {
      if (attempt === 3 || !(error instanceof Error) || !['AbortError', 'TimeoutError', 'TypeError'].includes(error.name)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error('Unreachable retry state');
}

export function parseReportCatalogPage(raw: string, page: number, expected?: { pages: number; count: number }) {
  const source = sourcePage.parse(JSON.parse(raw)).dokumentlista;
  const pages = source['@sidor'];
  const count = source['@traffar'];
  const entries = Array.isArray(source.dokument) ? source.dokument : [source.dokument];
  if (pages > 250 || count > 5000 || source['@sida'] !== page ||
    (expected && (pages !== expected.pages || count !== expected.count)))
    throw new Error(`Report list changed or exceeded bounds on page ${page}`);
  const expectedLength = Math.min(20, count - (page - 1) * 20);
  if (expectedLength < 1 || entries.length !== expectedLength ||
    source['@traff_fran'] !== (page - 1) * 20 + 1 ||
    source['@traff_till'] !== (page - 1) * 20 + entries.length ||
    pages !== Math.ceil(count / 20))
    throw new Error(`Incomplete report list page ${page}`);
  const next = source['@nasta_sida'];
  if (page < pages) {
    if (!next) throw new Error(`Missing next-page link on page ${page}`);
    const nextUrl = new URL(next);
    if (nextUrl.hostname !== 'data.riksdagen.se' || nextUrl.pathname !== '/dokumentlista/' ||
      nextUrl.searchParams.get('p') !== String(page + 1) ||
      nextUrl.searchParams.get('doktyp') !== 'bet' ||
      nextUrl.searchParams.get('rm') !== REPORT_SESSION ||
      nextUrl.searchParams.get('beslutad') !== '1' ||
      nextUrl.searchParams.get('sort') !== 'datum' ||
      nextUrl.searchParams.get('sortorder') !== 'asc')
      throw new Error(`Unexpected next-page link on page ${page}`);
  } else if (next) throw new Error('Final page unexpectedly has a next-page link');

  return {
    pages,
    count,
    sourceHash: createHash('sha256').update(raw).digest('hex'),
    entries: entries.map((item) => {
      if (item.rm !== REPORT_SESSION || item.doktyp !== 'bet' || item.beslutad !== '1')
        throw new Error(`Unexpected report ${item.dok_id} on page ${page}`);
      const id = documentIdSchema.parse(item.dok_id);
      return { documentId: id, designation: item.beteckning, title: item.titel, sourceDate: item.datum || null, page };
    }),
  };
}

export async function collectReportCatalog(load = downloadReportCatalogPage) {
  const first = parseReportCatalogPage(await load(reportCatalogUrl(1)), 1);
  const parsed = [first];
  const ids = new Set(first.entries.map((item) => item.documentId.toUpperCase()));
  if (ids.size !== first.entries.length) throw new Error('Duplicate report IDs in first page');
  for (let page = 2; page <= first.pages; page++) {
    const result = parseReportCatalogPage(await load(reportCatalogUrl(page)), page, { pages: first.pages, count: first.count });
    for (const item of result.entries) {
      if (ids.has(item.documentId.toUpperCase())) throw new Error(`Duplicate report ID ${item.documentId}`);
      ids.add(item.documentId.toUpperCase());
    }
    parsed.push(result);
  }
  if (ids.size !== first.count) throw new Error(`Report catalog count mismatch: ${ids.size}/${first.count}`);
  return {
    sourceUrl: reportCatalogUrl(1),
    sourceHash: createHash('sha256').update(parsed.map((item) => item.sourceHash).join(':')).digest('hex'),
    expectedCount: first.count,
    pageCount: first.pages,
    pages: parsed.flatMap((item, index) => ({ page: index + 1, sourceUrl: reportCatalogUrl(index + 1), sourceHash: item.sourceHash, itemCount: item.entries.length })),
    entries: parsed.flatMap((item) => item.entries),
  };
}
