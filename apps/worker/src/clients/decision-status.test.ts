import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decisionFixture } from './decision-fixture';
import { parseDecisionStatus } from './decision-status';

test('retains report point and official vote ID without inventing an acclamation vote', () => {
  const result = parseDecisionStatus(decisionFixture, 'HD01TU8');
  assert.equal(result.document.decisionDate, '2026-02-25');
  assert.equal(
    result.points[0].sourceVoteId,
    '32518106-3c98-46ad-9271-fa4c5b1fca5e',
  );
  assert.equal(result.points[1].decisionType, 'acklamation');
  assert.equal(result.points[1].sourceVoteId, null);
  assert.equal(result.points[0].proposalText.includes('<BR/>'), false);
  assert.match(result.sourceHash, /^[a-f0-9]{64}$/);
});

test('rejects mixed documents, duplicate points, and malformed vote IDs', () => {
  assert.throws(
    () => parseDecisionStatus(decisionFixture, 'HD01TU9'),
    /Unexpected document/,
  );
  const duplicate = JSON.parse(decisionFixture);
  duplicate.dokumentstatus.dokutskottsforslag.utskottsforslag[1].punkt = '1';
  assert.throws(
    () => parseDecisionStatus(JSON.stringify(duplicate), 'HD01TU8'),
    /Duplicate proposal point/,
  );
  duplicate.dokumentstatus.dokutskottsforslag.utskottsforslag[1].punkt = '2';
  duplicate.dokumentstatus.dokutskottsforslag.utskottsforslag[1].votering_id =
    'invalid-vote-id';
  assert.throws(
    () => parseDecisionStatus(JSON.stringify(duplicate), 'HD01TU8'),
    /Invalid vote ID/,
  );
});

test('CU21 preserves acclamation and its separate motivation vote without relabeling the point', () => {
  const raw = readFileSync(
    new URL('./fixtures/HD01CU21.json', import.meta.url),
    'utf8',
  );
  const result = parseDecisionStatus(raw, 'HD01CU21');
  assert.equal(result.points.length, 3);
  assert.equal(result.points[0].sourceVoteId, null);
  assert.equal(result.points[1].decisionType, 'acklamation');
  assert.equal(
    result.points[1].sourceVoteId,
    '62fbd172-047f-402b-b878-f5ba1a07005b',
  );
  assert.equal(result.points[2].decisionType, 'röstning');
  assert.equal(
    result.points[2].sourceVoteId,
    '055c92e2-ebb4-41b5-8740-52119aa63acc',
  );
});

test('FiU10 missing structured points stays unavailable rather than becoming a zero-point success', () => {
  const raw = readFileSync(
    new URL('./fixtures/HD01FiU10.json', import.meta.url),
    'utf8',
  );
  assert.throws(
    () => parseDecisionStatus(raw, 'HD01FiU10'),
    /Structured proposal points unavailable for HD01FiU10/,
  );
  const empty = JSON.parse(decisionFixture);
  empty.dokumentstatus.dokutskottsforslag.utskottsforslag = [];
  assert.throws(
    () => parseDecisionStatus(JSON.stringify(empty), 'HD01TU8'),
    /Structured proposal points unavailable/,
  );
  empty.dokumentstatus.dokutskottsforslag = {};
  assert.throws(() => parseDecisionStatus(JSON.stringify(empty), 'HD01TU8'));
  empty.dokumentstatus.dokutskottsforslag = null;
  assert.throws(() => parseDecisionStatus(JSON.stringify(empty), 'HD01TU8'));
});
