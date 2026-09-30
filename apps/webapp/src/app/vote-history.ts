import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  selector: 'app-vote-history',
  imports: [DatePipe, RouterLink],
  styles: [`.vote-count[aria-current="true"] { outline: 2px solid #096e59; outline-offset: 2px; }`],
  template: `
    <section class="panel">
      <h2>Registrerade röster · 2025/26</h2>
      <p>
        ”Frånvarande” är källans notering för en enskild votering, inte ett mått på närvaro i
        arbetet.
      </p>
      @if (result(); as history) {
        @if (history.summary; as summary) {
          <section aria-labelledby="vote-choice-heading">
            <h3 id="vote-choice-heading">Källans noteringar för personen</h3>
            <p>{{ summary.recordedEvents }} källposter för personens ID i
              {{ summary.sourceEvents }} importerade voteringshändelser {{ history.session }}.
              Antalen nedan gäller alla dessa {{ summary.recordedEvents }} källposter.</p>
            <nav aria-label="Filtrera rösthistorik efter källvärde">
              <a class="vote-count" [routerLink]="[]" [queryParams]="{ votesPage: 1, voteChoice: null }"
                queryParamsHandling="merge" [attr.aria-current]="history.choice === null ? 'true' : null">Alla</a>
              @for (group of summary.choices; track group.choice) {
                <a class="vote-count" [routerLink]="[]" [queryParams]="{ votesPage: 1, voteChoice: group.choice }"
                  queryParamsHandling="merge" [attr.aria-current]="history.choice === group.choice ? 'true' : null">
                  {{ group.choice || 'Okänt källvärde' }}: {{ group.count }}
                </a>
              }
            </nav>
            <p>{{ summary.eventsWithoutMemberRecord }} voteringshändelser saknar källpost för detta ID
              och ingår inte i antalen. Det kan bero på vilka personer källan redovisar för varje votering.
              Saknad post räknas inte som Frånvarande.
              {{ summary.eventsWithoutDate }} av personens källposter saknar datum och ingår ändå.</p>
            <aside class="notice">
              Session {{ history.session }} · import slutförd {{ summary.importedAt | date: 'yyyy-MM-dd HH:mm' }}.
              Beslut utan registrerad votering ingår inte. Flera voteringar kan gälla samma ärende eller punkt,
              och både sakfråga och motivering ingår när de finns i datasetet.
              <a [href]="summary.sourceArchiveUrl" target="_blank" rel="noopener">Källa: Sveriges riksdag · voteringsdataset ↗</a>
            </aside>
          </section>
          <p>{{ history.total }} källposter visas med filtret
            ”{{ history.choice === null ? 'Alla' : (history.choice || 'Okänt källvärde') }}”.</p>
        } @else {
          <p>Ingen slutförd voteringsimport för {{ history.session }} finns ännu.</p>
        }
        <ul class="assignments">
          @for (row of history.items; track row.event.voteId) {
            <li>
              <a [routerLink]="['/votering', row.event.voteId]"
                >{{ row.event.designation }} · punkt {{ row.event.proposalPoint }}</a
              >
              <span>{{ row.event.voteDate || 'Datum okänt' }} · {{ row.choice }}</span>
            </li>
          } @empty {
            <li>Inga källposter för detta ID med det valda filtret.</li>
          }
        </ul>
        <nav class="pagination" aria-label="Rösthistorik">
          @if (history.page > 1) {
            <a [routerLink]="[]" [queryParams]="{ votesPage: history.page - 1 }" queryParamsHandling="merge">← Föregående</a>
          }
          <span>Sida {{ history.page }}</span>
          @if (history.page * history.limit < history.total) {
            <a [routerLink]="[]" [queryParams]="{ votesPage: history.page + 1 }" queryParamsHandling="merge">Nästa →</a>
          }
        </nav>
      } @else {
        <p>Rösthistoriken kunde inte hämtas.</p>
      }
    </section>
  `,
})
export class VoteHistoryComponent {
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  result = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      switchMap(([params, query]) =>
        this.service
          .memberVotes(params.get('id') ?? '', Math.max(1, Number(query.get('votesPage')) || 1), query.get('voteChoice'))
          .pipe(catchError(() => of(null))),
      ),
    ),
    { initialValue: null },
  );
}
