import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PersonApiResponseSchema } from '@rikskollen/shared-types';
import { getPersons } from './person';

// Small synthetic shape based on the public personlista JSON, with empty
// attribute IDs observed in the Riksdag's 2026-09-29 response.
function person(id: string, party: string) {
  return {
    intressent_id: id,
    sourceid:
      id === '1'
        ? '3aebee98-eff2-4092-9618-b017c1821b84'
        : '8f411454-d7ac-46dd-b505-ad4de24ad18b',
    fodd_ar: '1970',
    kon: 'man',
    efternamn: `Efternamn${id}`,
    tilltalsnamn: `Namn${id}`,
    parti: party,
    valkrets: 'Stockholms län',
    status: 'Tjänstgörande riksdagsledamot',
    person_url_xml: null,
    bild_url_max: null,
    personuppdrag: {
      uppdrag: [
        {
          organ_kod: 'kam',
          roll_kod: 'Riksdagsledamot',
          ordningsnummer: '1',
          status: 'Tjänstgörande',
          typ: 'kammaruppdrag',
          from: '2026-09-28',
          tom: '',
          uppgift: [{}],
          intressent_id: id,
        },
      ],
    },
    personuppgift: {
      uppgift: [
        {
          kod: 'Biografi',
          uppgift: ['Text'],
          typ: 'biografi',
          intressent_id: '',
        },
      ],
    },
  };
}
function page(people: ReturnType<typeof person>[], hits = people.length) {
  return PersonApiResponseSchema.parse({
    personlista: {
      '@hits': String(hits),
      '@systemdatum': '2026-09-29 12:00:00',
      person: people,
    },
  });
}
process.env.RIKSDAG_API_URL = 'https://data.riksdagen.se';
test('reconciles filtered batches and maps observed empty attribute IDs', async () => {
  const a = person('1', 'M'),
    b = person('2', 'S');
  const result = await getPersons(async (url) =>
    url.includes('parti=M')
      ? page([a])
      : url.includes('parti=S')
        ? page([b])
        : page([a, b]),
  );
  assert.equal(result.expectedCount, 2);
  assert.equal(result.batchCount, 2);
  assert.equal(result.items[0].person.assignments[0].personId, '1');
  assert.match(result.items[0].sourceHash, /^[a-f0-9]{64}$/);
});
test('rejects incomplete batch before persistence', async () => {
  const a = person('1', 'M');
  await assert.rejects(
    getPersons(async (url) =>
      url.includes('parti=') ? page([], 1) : page([a]),
    ),
    /Incomplete party batch/,
  );
});
test('rejects a source person not in the full roster', async () => {
  const a = person('1', 'M'),
    b = person('2', 'M');
  await assert.rejects(
    getPersons(async (url) => (url.includes('parti=') ? page([b]) : page([a]))),
    /Unexpected or duplicate/,
  );
});
