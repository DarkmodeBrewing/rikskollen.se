export interface Overview {
  session: '2025/26';
  generatedAt: string;
  votes: null | {
    runId: string;
    sourceUrl: string;
    importedAt: string;
    events: number;
    expectedEvents: number;
  };
  decisions: null | {
    catalogRunId: string;
    sourceUrl: string;
    catalogImportedAt: string;
    latestReportImportedAt: string | null;
    reports: number;
    sourceReports: number;
    excludedReports: number;
    sourceGaps: number;
    points: number;
    methods: {
      recordedVote: number;
      acclamation: number;
      other: number;
      unknown: number;
    };
    sourceValues: Array<{ value: string; count: number }>;
    undatedReports: number;
    recent: Array<{
      documentId: string;
      designation: string;
      title: string;
      decisionDate: string;
      sourceUrl: string;
      importedAt: string;
    }>;
  };
}
