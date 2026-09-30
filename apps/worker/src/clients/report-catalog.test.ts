import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectReportCatalog, parseReportCatalogPage, reportCatalogUrl } from './report-catalog';

// Minimal two-page fixture using the metadata/field shape observed from the
// official 2025/26 decided-report list on 2026-09-30.
const records = Array.from({ length: 21 }, (_, index) => ({
  dok_id: `HD01TU${index + 1}`, rm: '2025/26', doktyp: 'bet',
  beteckning: `TU${index + 1}`, titel: `Betänkande ${index + 1}`,
  datum: '2026-01-01', beslutad: '1',
}));
function page(number: number, changes: Record<string, unknown> = {}) {
  const from = (number - 1) * 20;
  return JSON.stringify({ dokumentlista: {
    '@sida': String(number), '@sidor': '2', '@traffar': '21',
    '@traff_fran': String(from + 1), '@traff_till': String(Math.min(21, from + 20)),
    ...(number === 1 ? { '@nasta_sida': reportCatalogUrl(2).replace('https:', 'http:') } : {}),
    dokument: number === 1 ? records.slice(0, 20) : records[20],
    ...changes,
  } });
}

test('reconciles both pages and retains provenance without publishing partial lists', async () => {
  const result = await collectReportCatalog(async (url) => url.endsWith('p=1') ? page(1) : page(2));
  assert.equal(result.expectedCount, 21);
  assert.equal(result.entries.length, 21);
  assert.equal(result.pages[1].itemCount, 1);
  assert.equal(result.entries[7].documentId, 'HD01TU8');
  assert.match(result.pages[0].sourceHash, /^[a-f0-9]{64}$/);
});

test('rejects repeated, missing and shifted source pages', async () => {
  await assert.rejects(collectReportCatalog(async (url) => url.endsWith('p=1')
    ? page(1) : page(2, { dokument: records[7] })), /Duplicate report ID/);
  await assert.rejects(collectReportCatalog(async (url) => url.endsWith('p=1')
    ? page(1) : page(2, { '@traffar': '22' })), /changed or exceeded bounds/);
  assert.throws(() => parseReportCatalogPage(page(1, { '@nasta_sida': 'https://other.example/?p=2' }), 1), /Unexpected next-page link/);
  assert.throws(() => parseReportCatalogPage(page(1, { dokument: records.slice(0, 19) }), 1), /Incomplete report list page/);
});
