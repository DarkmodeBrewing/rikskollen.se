import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { parseVoteFile, readVoteArchive } from './vote-dataset';

import { fixtureArchive, fixtureRows } from './vote-fixture';
process.env.RIKSDAG_API_URL = 'https://data.riksdagen.se';
test('parses the session archive and preserves one choice per stable person ID', () => {
  const archive = readVoteArchive(fixtureArchive());
  assert.equal(archive.names.length, 1);
  const parsed = parseVoteFile(
    archive.names[0],
    archive.files[archive.names[0]],
    'https://data.riksdagen.se/dataset/votering/votering-202526.json.zip',
  );
  assert.equal(parsed.event.documentId, 'HD01AU10');
  assert.equal(parsed.event.proposalPoint, '13');
  assert.equal(parsed.choices.length, 349);
  assert.equal(parsed.choices[0].choice, 'Frånvarande');
  assert.match(parsed.event.sourceHash, /^[a-f0-9]{64}$/);
});
test('rejects missing or duplicate member rows', () => {
  const short = readVoteArchive(fixtureArchive(fixtureRows(348)));
  assert.throws(
    () => parseVoteFile(short.names[0], short.files[short.names[0]], 'source'),
    /Unexpected member row count/,
  );
  const duplicate = fixtureRows();
  duplicate[1].intressent_id = duplicate[0].intressent_id;
  const archive = readVoteArchive(fixtureArchive(duplicate));
  assert.throws(
    () =>
      parseVoteFile(
        archive.names[0],
        archive.files[archive.names[0]],
        'source',
      ),
    /duplicate vote row/,
  );
});
test('rejects a damaged or unexpected archive', () => {
  assert.throws(() => readVoteArchive(new Uint8Array([1, 2, 3])), /./);
  assert.throws(
    () => readVoteArchive(zipSync({ 'other.txt': strToU8('bad') })),
    /Unexpected archive entry/,
  );
});
