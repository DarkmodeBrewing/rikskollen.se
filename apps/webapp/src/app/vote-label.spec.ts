import { voteLabel } from './vote-label';
describe('voteLabel', () => {
  it('prefers exact point context, then report text, then an honest missing-title label', () => {
    expect(voteLabel({ context: { pointHeading: 'Digital delaktighet', reportTitle: 'Postfrågor' } })).toBe('Digital delaktighet');
    expect(voteLabel({ context: { pointHeading: null, reportTitle: 'Postfrågor' } })).toBe('Postfrågor');
    expect(voteLabel({})).toBe('Votering utan importerad rubrik');
  });
});
