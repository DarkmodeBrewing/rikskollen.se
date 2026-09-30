import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';

export interface Assignment {
  organCode: string;
  roleCode: string;
  kind: string;
  status: string | null;
  from: string | null;
  to: string | null;
  value: string | null;
  order: number;
}
export interface Member {
  personId: string;
  givenName: string;
  lastName: string;
  partyCode: string;
  constituency: string;
  status: string | null;
  personUrl: string | null;
  sourceUrl: string;
  fetchedAt: string;
  assignments: Assignment[];
}
export interface MemberList {
  items: Member[];
  total: number;
  page: number;
  limit: number;
}
export interface ImportStatus {
  expectedCount: number;
  importedCount: number;
  currentCount: number;
  batchCount: number;
  completedAt: string;
  complete: boolean;
  sourceUrl: string;
}

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);
  private readonly base = isPlatformServer(inject(PLATFORM_ID))
    ? process.env['API_BASE_URL'] || 'http://localhost:3000'
    : '';
  list(q: string, page: number) {
    return this.http.get<MemberList>(`${this.base}/api/persons`, {
      params: { q, page, limit: 30 },
    });
  }
  get(id: string) {
    return this.http.get<Member>(`${this.base}/api/persons/${encodeURIComponent(id)}`);
  }
  votes(page: number) {
    return this.http.get<VoteList>(`${this.base}/api/votes`, { params: { page, limit: 30 } });
  }
  vote(id: string) {
    return this.http.get<VoteDetail>(`${this.base}/api/votes/${encodeURIComponent(id)}`);
  }
  voteStatus() {
    return this.http.get<VoteStatus | null>(`${this.base}/api/votes/import-status`);
  }
  decision(id: string) {
    return this.http.get<DecisionTrail>(`${this.base}/api/decisions/${encodeURIComponent(id)}`);
  }
  decisions(page: number) {
    return this.http.get<DecisionList>(`${this.base}/api/decisions`, { params: { page, limit: 30 } });
  }
  memberVotes(id: string, page: number) {
    return this.http.get<MemberVotes>(`${this.base}/api/persons/${encodeURIComponent(id)}/votes`, {
      params: { page, limit: 20 },
    });
  }
  status() {
    return this.http.get<ImportStatus | null>(`${this.base}/api/import-status`);
  }
}

export interface VoteEvent {
  voteId: string;
  session: string;
  designation: string;
  proposalPoint: string;
  documentId: string | null;
  subjectType: string;
  mainVoteType: string;
  voteDate: string | null;
  sourceUrl: string;
  sourceFile: string;
}
export interface VoteList {
  items: VoteEvent[];
  total: number;
  page: number;
  limit: number;
  session: string;
}
export interface VoteStatus {
  session: string;
  expectedFiles: number;
  eventCount: number;
  choiceCount: number;
  complete: boolean;
  completedAt: string;
  sourceUrl: string;
}
export interface VoteChoice {
  memberProfileAvailable: boolean;
  personId: string;
  sourceName: string;
  partyCode: string;
  constituency: string;
  choice: string;
}
export interface VoteDetail {
  event: VoteEvent;
  decisionTrailAvailable: boolean;
  choices: VoteChoice[];
  counts: Record<string, number>;
  total: number;
  sourceArchiveUrl: string;
  importedAt: string;
}
export interface DecisionPoint {
  point: string;
  heading: string;
  proposalText: string;
  decisionType: string;
  winner: string | null;
  sourceVoteId: string | null;
  localVoteAvailable: boolean;
}
export interface DecisionTrail {
  document: { documentId: string; session: string; designation: string; title: string; status: string; decisionDate: string | null };
  points: DecisionPoint[];
  sourceUrl: string;
  importedAt: string;
  expectedPoints: number;
}
export interface DecisionList {
  items: Array<{ documentId: string; session: string; designation: string; title: string; decisionDate: string | null; pointCount: number; sourceUrl: string; importedAt: string }>;
  total: number;
  page: number;
  limit: number;
  coverage: null | {
    session: string;
    voteRunId: string;
    voteSourceUrl: string;
    sourceDocuments: number;
    importedDocuments: number;
    voteEventsWithoutDocument: number;
  };
  catalogCoverage: null | {
    session: string;
    catalogRunId: string;
    catalogSourceUrl: string;
    catalogCompletedAt: string;
    sourceDocuments: number;
    importedDocuments: number;
    withRecordedVote: number | null;
  };
  decisionMethodSummary: null | {
    session: string;
    sourceDocuments: number;
    importedDocuments: number;
    excludedDocuments: number;
    totalPoints: number;
    counts: { recordedVote: number; acclamation: number; other: number; unknown: number };
    sourceValues: Array<{ sourceValue: string; count: number }>;
    catalogSourceUrl: string;
    catalogCompletedAt: string;
  };
}
export interface MemberVotes {
  items: Array<{ event: VoteEvent; choice: string }>;
  total: number;
  page: number;
  limit: number;
  session: string;
}
