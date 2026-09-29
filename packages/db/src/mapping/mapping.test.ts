import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PersonSchema, VoteCaseSchema } from '@rikskollen/shared-types';
import { mapToPoliticianDto } from './person';
import { mapToVoteCaseDto } from './vote-case';

// Reduced examples from the Riksdag-shaped records documented in the existing
// persons.ts and vote-case.ts schema files. These are mapping fixtures, not a
// claim of complete coverage of the live API.
test('maps string-valued source fields without inventing an assignment value', () => {
  const source = PersonSchema.parse({
    intressent_id: '0251136832626',
    sourceid: '8f411454-d7ac-46dd-b505-ad4de24ad18b',
    fodd_ar: '1976',
    kon: 'man',
    efternamn: 'Demirok',
    tilltalsnamn: 'Muharrem',
    parti: 'C',
    valkrets: 'Östergötlands län',
    status: 'Tjänstgörande riksdagsledamot',
    person_url_xml: 'https://data.riksdagen.se/person/8f411454-d7ac-46dd-b505-ad4de24ad18b',
    bild_url_max: 'https://data.riksdagen.se/example.jpg',
    personuppdrag: {
      uppdrag: [{
        organ_kod: 'kam',
        roll_kod: 'Riksdagsledamot',
        ordningsnummer: '326',
        status: 'Tjänstgörande',
        typ: 'kammaruppdrag',
        from: '2022-09-26 11:00:00',
        tom: '2026-09-28 10:59:00',
        uppgift: [{}],
        intressent_id: '0251136832626',
      }],
    },
    personuppgift: {
      uppgift: [{
        kod: 'HarBild',
        uppgift: ['true'],
        typ: 'bilder',
        intressent_id: '0251136832626',
      }],
    },
  });

  const mapped = mapToPoliticianDto(source);
  assert.equal(mapped.personId, source.intressent_id);
  assert.equal(mapped.birthYear, 1976);
  assert.equal(mapped.assignments[0].order, 326);
  assert.equal(mapped.assignments[0].from, '2022-09-26 11:00:00');
  assert.equal(mapped.assignments[0].value, null);
  assert.deepEqual(mapped.attributes[0].value, ['true']);
});

test('keeps missing optional person data unknown', () => {
  const source = PersonSchema.parse({
    intressent_id: 'example',
    sourceid: '8f411454-d7ac-46dd-b505-ad4de24ad18b',
    kon: '',
    efternamn: 'Example',
    tilltalsnamn: 'Test',
    parti: 'C',
    valkrets: 'Example',
    status: '',
  });
  const mapped = mapToPoliticianDto(source);
  assert.equal(mapped.birthYear, null);
  assert.equal(mapped.politicianUrl, null);
  assert.deepEqual(mapped.assignments, []);
  assert.deepEqual(mapped.attributes, []);
});

test('preserves the source vote and proposal-point identifiers', () => {
  const source = VoteCaseSchema.parse({
    votering_id: '8E788F46-829A-4417-B10B-3C3BA7815526',
    rm: '2025/26',
    beteckning: 'AU4',
    punkt: '2',
    avser: 'sakfrågan',
    dok_id: 'HD01AU4',
    votering: 'huvud',
  });
  assert.deepEqual(mapToVoteCaseDto(source), {
    voteId: source.votering_id,
    rm: '2025/26',
    beteckning: 'AU4',
    punkt: '2',
    dokId: 'HD01AU4',
    mainVoteType: 'huvud',
    subjectType: 'sakfrågan',
  });
});
