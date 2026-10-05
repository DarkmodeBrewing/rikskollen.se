import { voteLabel } from './vote-label';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { requestState, type RequestState } from './request-state';
import { MemberService, type VoteStatus, type VoteList } from './member.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    @let statusState = status();
    @if (statusState.status === 'ready') {
      @if (statusState.data; as run) {
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
    } @else if (statusState.status === 'loading') {
      <aside class="notice" role="status">Hämtar importstatus…</aside>
    } @else {
      <aside class="notice" role="alert">Voteringsimportens status kunde inte hämtas.</aside>
    }
    @let pageState = result();
    @if (pageState.status === 'ready') {
      @let votes = pageState.data;
      <p class="count">{{ votes.total }} voteringar</p>
      <ul class="members document-list">
        @for (vote of votes.items; track vote.voteId) {
          <li>
            <a [routerLink]="['/votering', vote.voteId]"
              ><div class="list-main">
                <strong>{{ voteLabel(vote) }}</strong>
                @if (vote.context?.pointHeading && vote.context?.reportTitle) {
                  <span>{{ vote.context?.reportTitle }}</span>
                }
                <small
                  >{{ vote.designation }} · punkt {{ vote.proposalPoint }} ·
                  {{ vote.session }}</small
                >
                <span
                  >{{ vote.voteDate || 'Datum saknas i källan' }} · {{ vote.subjectType }} ·
                  {{ vote.mainVoteType }}</span
                >
              </div>
              <b aria-hidden="true">→</b></a
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
    } @else if (pageState.status === 'loading') {
      <p role="status">Hämtar voteringar…</p>
    } @else {
      <p role="alert">Voteringarna kunde inte hämtas. Försök igen senare.</p>
    }
  `,
})
export class VoteListComponent {
  protected readonly voteLabel = voteLabel;
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  status = toSignal(requestState(this.service.voteStatus()), {
    initialValue: { status: 'loading' } as RequestState<VoteStatus | null>,
  });
  result = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => Math.max(1, Number(params.get('page')) || 1)),
      switchMap((page) => requestState(this.service.votes(page))),
    ),
    { initialValue: { status: 'loading' } as RequestState<VoteList> },
  );
  pages(total: number, limit: number) {
    return Math.max(1, Math.ceil(total / limit));
  }
}
