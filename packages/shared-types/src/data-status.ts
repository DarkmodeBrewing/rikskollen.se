export type ImportDataset = 'members' | 'votes' | 'catalog' | 'decisions';
export type ImportJob =
  | 'persons'
  | 'votes'
  | 'report-catalog'
  | 'decision'
  | 'catalog-decisions'
  | 'vote-linked-decisions'
  | 'refresh-decisions';
export interface PublishedCoverage {
  dataset: ImportDataset;
  session: string | null;
  snapshotId: string;
  sourceUrl: string;
  expectedCount: number;
  importedCount: number;
  complete: boolean;
  lastSuccessfulAt: string | null;
  oldestSuccessfulAt: string | null;
  secondaryCount: number | null;
}
export interface PublicImportAttempt {
  id: string;
  dataset: ImportDataset;
  job: ImportJob;
  session: string | null;
  documentId: string | null;
  trigger: 'manual' | 'scheduled';
  unchanged: boolean;
  status: 'running' | 'succeeded' | 'failed';
  expectedCount: number | null;
  importedCount: number;
  snapshotId: string | null;
  unavailableCount?: number;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
}
export interface DataStatus {
  sourceAvailability?: {
    unavailableCount: number;
    limit: number;
    items: Array<{
      documentId: string;
      title: string;
      sourceUrl: string;
      checkedAt: string;
      reason: 'structured-points-missing';
      hasPublishedDetails: boolean;
    }>;
  };
  generatedAt: string;
  trackingStartedAt: string | null;
  coverage: PublishedCoverage[];
  latestAttempts: PublicImportAttempt[];
  history: {
    items: PublicImportAttempt[];
    total: number;
    page: number;
    limit: number;
  };
}
