// Reduced excerpt of Sveriges riksdag's documentstatus/HD01TU8.json, observed 2026-09-30.
// Point 1 was decided by recorded vote; point 2 by acclamation.
export const decisionFixture = JSON.stringify({
  dokumentstatus: {
    dokument: {
      dok_id: 'HD01TU8', rm: '2025/26', beteckning: 'TU8',
      titel: 'Digitaliserings- och postfrågor', status: 'Webbpublicering', doktyp: 'bet',
    },
    dokutskottsforslag: { utskottsforslag: [
      { punkt: '1', rubrik: 'Utgångspunkter för digitaliseringspolitiken',
        forslag: '<BR/>Riksdagen avslår motionerna 2025/26:2297 och 2025/26:3560.<BR/>',
        beslutstyp: 'röstning', vinnare: 'utskottet',
        votering_id: '32518106-3c98-46ad-9271-fa4c5b1fca5e' },
      { punkt: '2', rubrik: 'Digital delaktighet',
        forslag: '<BR/>Riksdagen avslår motioner om digital delaktighet.<BR/>',
        beslutstyp: 'acklamation', vinnare: 'utskottet', votering_id: '' },
    ] },
    dokuppgift: { uppgift: [{ kod: 'beslutdatumtid', text: '2026-02-25 00:00:00' }] },
  },
});
