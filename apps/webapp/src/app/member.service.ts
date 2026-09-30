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
  choices: VoteChoice[];
  counts: Record<string, number>;
  total: number;
  sourceArchiveUrl: string;
  importedAt: string;
}
export interface MemberVotes {
  items: Array<{ event: VoteEvent; choice: string }>;
  total: number;
  page: number;
  limit: number;
  session: string;
}
