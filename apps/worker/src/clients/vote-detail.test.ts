import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseVoteDetail } from './vote-detail';
import { parseVoteFile } from './vote-dataset';
import { fixtureRows } from './vote-fixture';
const base = new URL('./fixtures/', import.meta.url);
const evidence = JSON.parse(readFileSync(new URL('vote-metadata-examples.json', base), 'utf8'));
for (const sample of evidence.examples) {
  test(`thin archive and richer source metadata: ${sample.eventFields.votering_id}`, () => {
    // Only event fields are copied from source; person rows are synthetic.
    const rows = fixtureRows().map(row => ({ ...row, ...sample.eventFields }));
    const event = parseVoteFile(sample.filename, Buffer.from(JSON.stringify({ dokvotering: { votering: rows } })), evidence.archiveUrl).event;
    assert.equal(event.voteDate, null);
    assert.equal(event.documentId, null);
    const raw = readFileSync(new URL(sample.detailFixture, base), 'utf8');
    const details = parseVoteDetail(raw, event);
    assert.equal(details.detailSourceHash, sample.detailSha256);
    assert.match(details.detailTitle, /^Omröstning:/);
    assert.match(details.detailDate, /^202[56]-\d{2}-\d{2}$/);
    assert.equal(event.voteDate, null, 'never overwrite the original archive value');
    for (const field of ['sourceid', 'rm', 'beteckning', 'tempbeteckning', 'datum', 'titel']) {
      const malformed = JSON.parse(raw);
      malformed.votering.dokument[field] = field === 'datum' ? '2026-02-30 00:00:00' : '';
      assert.throws(() => parseVoteDetail(JSON.stringify(malformed), event));
    }
    assert.throws(() => parseVoteDetail(raw, { ...event, voteDate: '2020-01-01' }), /Conflicting/);
  });
}
