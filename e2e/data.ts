import type {
  Member,
  VoteEvent,
  DecisionTrail,
  MemberVotes,
  DecisionList,
} from '../apps/webapp/src/app/member.service';

// Synthetic contract fixtures, never a copy of a member's personal-data record.
export const timestamp = '2026-01-10T12:00:00Z';
export const member: Member = {
  personId: '0000000000001',
  givenName: 'Test',
  lastName: 'Ledamot',
  partyCode: 'TEST',
  constituency: 'Testkrets',
  status: 'Tjänstgörande',
  personUrl: 'https://data.riksdagen.se/person/0000000000001',
  sourceUrl: 'https://data.riksdagen.se/personlista/',
  fetchedAt: timestamp,
  assignments: [],
};
export const events: VoteEvent[] = Array.from({ length: 25 }, (_, index) => ({
  voteId: `test-vote-${index + 1}`,
  context:
    index === 0
      ? {
          reportTitle: 'Syntetiskt testärende',
          pointHeading: 'Registrerad omröstning',
          titleSourceUrl:
            'https://data.riksdagen.se/dokumentstatus/TESTREPORT.json',
          titleImportedAt: timestamp,
          pointSourceUrl:
            'https://data.riksdagen.se/dokumentstatus/TESTREPORT.json',
          pointImportedAt: timestamp,
        }
      : undefined,
  session: '2025/26',
  designation: 'TEST1',
  proposalPoint: String(index + 1),
  documentId: 'TESTREPORT',
  subjectType: 'sakfråga',
  mainVoteType: 'huvudvotering',
  voteDate: index === 24 ? null : '2026-01-09',
  sourceUrl: `https://data.riksdagen.se/votering/test-vote-${index + 1}`,
  sourceFile: `test-${index + 1}.json`,
}));
export const history: MemberVotes = {
  items: events.map((event, index) => ({
    event,
    choice: index < 21 ? 'Frånvarande' : index < 24 ? 'Ja' : 'Oväntat',
  })),
  total: 25,
  page: 1,
  limit: 20,
  session: '2025/26',
  choice: null,
  summary: {
    recordedEvents: 25,
    choices: [
      { choice: 'Frånvarande', count: 21 },
      { choice: 'Ja', count: 3 },
      { choice: 'Oväntat', count: 1 },
    ],
    sourceEvents: 27,
    eventsWithoutMemberRecord: 2,
    eventsWithoutDate: 1,
    voteRunId: 'synthetic-vote-run',
    sourceArchiveUrl: 'https://data.riksdagen.se/dataset/test.zip',
    importedAt: timestamp,
  },
};
export const trail: DecisionTrail = {
  document: {
    documentId: 'TESTREPORT',
    session: '2025/26',
    designation: 'TEST1',
    title: 'Syntetiskt testärende',
    status: 'beslutad',
    decisionDate: null,
  },
  points: [
    {
      point: '1',
      heading: 'Registrerad omröstning',
      proposalText: 'Syntetiskt förslag ett.',
      decisionType: 'röstning',
      winner: null,
      sourceVoteId: events[0].voteId,
      localVoteAvailable: true,
    },
    {
      point: '2',
      heading: 'Acklamation',
      proposalText: 'Syntetiskt förslag två.',
      decisionType: 'acklamation',
      winner: null,
      sourceVoteId: null,
      localVoteAvailable: false,
    },
    {
      point: '3',
      heading: 'Ej importerad votering',
      proposalText: 'Syntetiskt förslag tre.',
      decisionType: 'röstning',
      winner: null,
      sourceVoteId: 'unavailable-vote',
      localVoteAvailable: false,
    },
    {
      point: '4',
      heading: 'Annan metod',
      proposalText: 'Syntetiskt förslag fyra.',
      decisionType: 'annat',
      winner: null,
      sourceVoteId: null,
      localVoteAvailable: false,
    },
    {
      point: '5',
      heading: 'Okänd metod',
      proposalText: 'Syntetiskt förslag fem.',
      decisionType: '',
      winner: null,
      sourceVoteId: null,
      localVoteAvailable: false,
    },
  ],
  sourceUrl: 'https://data.riksdagen.se/dokumentstatus/TESTREPORT.json',
  importedAt: timestamp,
  expectedPoints: 5,
};
export const decisions: DecisionList = {
  items: [
    {
      ...trail.document,
      pointCount: 5,
      sourceUrl: trail.sourceUrl,
      importedAt: timestamp,
    },
  ],
  total: 1,
  page: 1,
  limit: 30,
  coverage: null,
  catalogCoverage: {
    session: '2025/26',
    catalogRunId: 'synthetic-catalog',
    catalogSourceUrl: 'https://data.riksdagen.se/dokumentlista/',
    catalogCompletedAt: timestamp,
    sourceDocuments: 3,
    importedDocuments: 1,
    withRecordedVote: 2,
  },
  decisionMethodSummary: {
    session: '2025/26',
    sourceDocuments: 3,
    importedDocuments: 1,
    excludedDocuments: 2,
    totalPoints: 5,
    counts: { recordedVote: 2, acclamation: 1, other: 1, unknown: 1 },
    sourceValues: [
      { sourceValue: 'röstning', count: 2 },
      { sourceValue: 'acklamation', count: 1 },
      { sourceValue: 'annat', count: 1 },
      { sourceValue: '', count: 1 },
    ],
    catalogSourceUrl: 'https://data.riksdagen.se/dokumentlista/',
    catalogCompletedAt: timestamp,
  },
};

// Operational data is synthetic; counts never claim real deployment coverage.
export const dataStatus: import('../packages/shared-types/src/data-status').DataStatus = {
  generatedAt: timestamp, trackingStartedAt: timestamp,
  coverage: [
    { dataset: 'members', session: null, snapshotId: '00000000-0000-0000-0000-000000000001', sourceUrl: member.sourceUrl,
      expectedCount: 31, importedCount: 31, complete: true, lastSuccessfulAt: timestamp, oldestSuccessfulAt: timestamp, secondaryCount: null },
    { dataset: 'votes', session: '2025/26', snapshotId: '00000000-0000-0000-0000-000000000002', sourceUrl: history.summary!.sourceArchiveUrl,
      expectedCount: 25, importedCount: 25, complete: true, lastSuccessfulAt: timestamp, oldestSuccessfulAt: timestamp, secondaryCount: 8725 },
    { dataset: 'catalog', session: '2025/26', snapshotId: '00000000-0000-0000-0000-000000000003', sourceUrl: 'https://data.riksdagen.se/dokumentlista/?rm=2025/26',
      expectedCount: 2, importedCount: 2, complete: true, lastSuccessfulAt: timestamp, oldestSuccessfulAt: timestamp, secondaryCount: null },
    { dataset: 'decisions', session: '2025/26', snapshotId: '00000000-0000-0000-0000-000000000003', sourceUrl: 'https://data.riksdagen.se/dokumentlista/?rm=2025/26',
      expectedCount: 2, importedCount: 1, complete: false, lastSuccessfulAt: timestamp, oldestSuccessfulAt: '2026-01-01T12:00:00Z', secondaryCount: 2 },
  ],
  latestAttempts: [{ id: '00000000-0000-0000-0000-000000000021', dataset: 'decisions', job: 'catalog-decisions', session: '2025/26', documentId: null,
    status: 'failed', expectedCount: 2, importedCount: 1, snapshotId: null, startedAt: timestamp, finishedAt: timestamp, durationSeconds: 0 }],
  history: { page: 1, limit: 20, total: 21,
    items: Array.from({ length: 21 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`, dataset: 'decisions', job: 'catalog-decisions', session: '2025/26', documentId: null,
      status: i === 0 ? 'running' : 'failed', expectedCount: 2, importedCount: 1, snapshotId: null,
      startedAt: timestamp, finishedAt: i === 0 ? null : timestamp, durationSeconds: i === 0 ? null : 0,
    })) },
};
