import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  selector: 'app-vote-list',
  imports: [DatePipe, RouterLink],
  template: `
    <section class="intro">
      <p class="eyebrow">Huvudvoteringar · 2025/26</p>
      <h1>Registrerade voteringar</h1>
      <p>
        Varje rad är en huvudvotering. Ett betänkande kan ha flera förslagspunkter, och många beslut
        fattas utan registrerad votering.
      </p>
    </section>
    @if (status(); as run) {
      <aside class="notice">
        @if (run.complete) {
          Fullständig import: {{ run.eventCount }} voteringar och
          {{ run.choiceCount }} ledamotsröster · {{ run.completedAt | date: 'yyyy-MM-dd HH:mm' }}.
        } @else {
          Importens täckning behöver kontrolleras.
        }
        <a [href]="run.sourceUrl" target="_blank" rel="noopener">Källdataset ↗</a>
      </aside>
    } @else {
      <aside class="notice">Ingen slutförd voteringsimport ännu.</aside>
    }
    @if (result(); as votes) {
      <p class="count">{{ votes.total }} voteringar</p>
      <ul class="members">
        @for (vote of votes.items; track vote.voteId) {
          <li>
            <a [routerLink]="['/votering', vote.voteId]"
              ><strong>{{ vote.designation }} · punkt {{ vote.proposalPoint }}</strong>
              <span>{{ vote.voteDate || 'Datum saknas i källan' }}</span
              ><small>{{ vote.subjectType }} · {{ vote.mainVoteType }}</small
              ><b aria-hidden="true">→</b></a
            >
          </li>
        } @empty {
          <li class="empty">Inga voteringar importerade.</li>
        }
      </ul>
      <nav class="pagination" aria-label="Sidindelning">
        @if (votes.page > 1) {
          <a routerLink="/voteringar" [queryParams]="{ page: votes.page - 1 }">← Föregående</a>
        }
        <span>Sida {{ votes.page }} av {{ pages(votes.total, votes.limit) }}</span>
        @if (votes.page * votes.limit < votes.total) {
          <a routerLink="/voteringar" [queryParams]="{ page: votes.page + 1 }">Nästa →</a>
        }
      </nav>
    } @else {
      <p>Voteringarna kunde inte hämtas.</p>
    }
  `,
})
export class VoteListComponent {
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  status = toSignal(this.service.voteStatus().pipe(catchError(() => of(null))), {
    initialValue: null,
  });
  result = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => Math.max(1, Number(params.get('page')) || 1)),
      switchMap((page) => this.service.votes(page).pipe(catchError(() => of(null)))),
    ),
    { initialValue: null },
  );
  pages(total: number, limit: number) {
    return Math.max(1, Math.ceil(total / limit));
  }
}
