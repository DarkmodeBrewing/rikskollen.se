import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  selector: 'app-vote-history',
  imports: [RouterLink],
  template: `
    <section class="panel">
      <h2>Registrerade röster · 2025/26</h2>
      <p>
        ”Frånvarande” är källans notering för en enskild votering, inte ett mått på närvaro i
        arbetet.
      </p>
      @if (result(); as history) {
        <p>{{ history.total }} registrerade voteringar i den importerade sessionen.</p>
        <ul class="assignments">
          @for (row of history.items; track row.event.voteId) {
            <li>
              <a [routerLink]="['/votering', row.event.voteId]"
                >{{ row.event.designation }} · punkt {{ row.event.proposalPoint }}</a
              >
              <span>{{ row.event.voteDate || 'Datum okänt' }} · {{ row.choice }}</span>
            </li>
          } @empty {
            <li>Inga registrerade röster i detta dataset.</li>
          }
        </ul>
        <nav class="pagination" aria-label="Rösthistorik">
          @if (history.page > 1) {
            <a [routerLink]="[]" [queryParams]="{ votesPage: history.page - 1 }">← Föregående</a>
          }
          <span>Sida {{ history.page }}</span>
          @if (history.page * history.limit < history.total) {
            <a [routerLink]="[]" [queryParams]="{ votesPage: history.page + 1 }">Nästa →</a>
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
          .memberVotes(params.get('id') ?? '', Math.max(1, Number(query.get('votesPage')) || 1))
          .pipe(catchError(() => of(null))),
      ),
    ),
    { initialValue: null },
  );
}
