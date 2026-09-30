import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decisionFixture } from './decision-fixture';
import { parseDecisionStatus } from './decision-status';

test('retains report point and official vote ID without inventing an acclamation vote', () => {
  const result = parseDecisionStatus(decisionFixture, 'HD01TU8');
  assert.equal(result.document.decisionDate, '2026-02-25');
  assert.equal(result.points[0].sourceVoteId, '32518106-3c98-46ad-9271-fa4c5b1fca5e');
  assert.equal(result.points[1].decisionType, 'acklamation');
  assert.equal(result.points[1].sourceVoteId, null);
  assert.equal(result.points[0].proposalText.includes('<BR/>'), false);
  assert.match(result.sourceHash, /^[a-f0-9]{64}$/);
});

test('rejects mixed documents, duplicate points, and contradictory acclamation', () => {
  assert.throws(() => parseDecisionStatus(decisionFixture, 'HD01TU9'), /Unexpected document/);
  const duplicate = JSON.parse(decisionFixture);
  duplicate.dokumentstatus.dokutskottsforslag.utskottsforslag[1].punkt = '1';
  assert.throws(() => parseDecisionStatus(JSON.stringify(duplicate), 'HD01TU8'), /Duplicate proposal point/);
  duplicate.dokumentstatus.dokutskottsforslag.utskottsforslag[1].punkt = '2';
  duplicate.dokumentstatus.dokutskottsforslag.utskottsforslag[1].votering_id = '32518106-3c98-46ad-9271-fa4c5b1fca5e';
  assert.throws(() => parseDecisionStatus(JSON.stringify(duplicate), 'HD01TU8'), /Acclamation point/);
});
