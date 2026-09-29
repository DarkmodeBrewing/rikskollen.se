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
  status() {
    return this.http.get<ImportStatus | null>(`${this.base}/api/import-status`);
  }
}
