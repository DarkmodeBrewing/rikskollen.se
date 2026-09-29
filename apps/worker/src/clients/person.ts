import { createHash } from 'node:crypto';
import { PersonApiResponseSchema, workerEnv } from '@rikskollen/shared-types';
import { mapToPoliticianDto } from '@rikskollen/db';
import { fetchJsonWithRetry } from '../lib/http';
import type { z } from 'zod';

export type PersonBatch = {
  items: Array<{
    person: ReturnType<typeof mapToPoliticianDto>;
    sourceUrl: string;
    sourceHash: string;
  }>;
  expectedCount: number;
  batchCount: number;
  sourceDate: string;
  sourceUrl: string;
};

// personlista has no page navigation. Party filters are bounded batches; the
// unfiltered serving roster provides the exact IDs to reconcile against.
export async function getPersons(
  fetchPage: (
    url: string,
  ) => Promise<z.output<typeof PersonApiResponseSchema>> = (url) =>
    fetchJsonWithRetry(url, PersonApiResponseSchema),
): Promise<PersonBatch> {
  const root = new URL('/personlista/', workerEnv().RIKSDAG_API_URL);
  root.searchParams.set('utformat', 'json');
  root.searchParams.set('sort', 'sorteringsnamn');
  root.searchParams.set('sortorder', 'asc');
  const roster = await fetchPage(root.toString());
  if (roster.personlista.person.length !== roster.personlista['@hits']) {
    throw new Error('Roster count does not match @hits');
  }
  const expected = new Map(
    roster.personlista.person.map((p) => [p.intressent_id, p.parti]),
  );
  if (expected.size !== roster.personlista['@hits'])
    throw new Error('Duplicate roster ID');
  const parties = [...new Set(expected.values())].sort();
  const seen = new Map<string, PersonBatch['items'][number]>();
  for (const party of parties) {
    const url = new URL(root);
    url.searchParams.set('parti', party);
    const response = await fetchPage(url.toString());
    const people = response.personlista.person;
    if (people.length !== response.personlista['@hits'])
      throw new Error(`Incomplete party batch: ${party}`);
    for (const person of people) {
      if (
        person.parti !== party ||
        expected.get(person.intressent_id) !== party ||
        seen.has(person.intressent_id)
      ) {
        throw new Error(
          `Unexpected or duplicate person in party batch: ${party}`,
        );
      }
      seen.set(person.intressent_id, {
        person: mapToPoliticianDto(person),
        sourceUrl: url.toString(),
        sourceHash: createHash('sha256')
          .update(JSON.stringify(person))
          .digest('hex'),
      });
    }
  }
  if (seen.size !== expected.size)
    throw new Error(`Incomplete roster: ${seen.size}/${expected.size}`);
  return {
    items: [...seen.values()],
    expectedCount: expected.size,
    batchCount: parties.length,
    sourceDate: roster.personlista['@systemdatum'],
    sourceUrl: root.toString(),
  };
}
