import { zipSync, strToU8 } from 'fflate';

// Synthetic 349-row file with the 2025/26 official dataset's dokvotering shape.
export const fixtureVoteId = '24315A72-DA70-49D3-9498-F15C5504F256';
export const fixtureName = `HD01AU10-13-${fixtureVoteId}.json`;
export function fixtureRows(count = 349) {
  return Array.from({ length: count }, (_, i) => ({
    rm: '2025/26',
    beteckning: 'AU10',
    punkt: '13',
    votering_id: fixtureVoteId,
    intressent_id: String(i + 1).padStart(13, '0'),
    namn: `Ledamot ${i + 1}`,
    parti: 'S',
    valkrets: 'Stockholms län',
    rost: i === 0 ? 'Frånvarande' : 'Ja',
    avser: 'sakfrågan',
    votering: 'huvud',
    datum: '2026-03-04',
  }));
}
export function fixtureArchive(rows = fixtureRows()) {
  return zipSync({
    [fixtureName]: strToU8(JSON.stringify({ dokvotering: { votering: rows } })),
  });
}
