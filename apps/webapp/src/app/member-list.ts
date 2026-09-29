import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  selector: 'app-member-list',
  imports: [AsyncPipe, DatePipe, RouterLink],
  template: `
    <section class="intro">
      <p class="eyebrow">Ledamöter</p>
      <h1>Utforska riksdagens ledamöter</h1>
      <p>
        Sök bland personer i den senast importerade tjänstgörande listan. Uppdrag och status återges
        som de står i källan.
      </p>
    </section>
    @if (status$ | async; as status) {
      <aside class="notice">
        @if (status.complete) {
          Senaste fullständiga import: {{ status.completedAt | date: 'yyyy-MM-dd HH:mm' }} ·
          {{ status.currentCount }} av {{ status.expectedCount }} personer ·
          {{ status.batchCount }} partier.
        } @else {
          Importens täckning behöver kontrolleras: {{ status.currentCount }} av
          {{ status.expectedCount }} personer.
        }
        <a [href]="status.sourceUrl" target="_blank" rel="noopener">Källans lista ↗</a>
      </aside>
    } @else {
      <aside class="notice">Ingen slutförd import ännu. Listan kan vara tom.</aside>
    }
    <form action="/" method="get" class="search">
      <label for="q">Sök namn, parti eller valkrets</label>
      <div>
        <input
          id="q"
          name="q"
          [value]="(params$ | async)?.q || ''"
          placeholder="Till exempel Stockholm"
        /><button type="submit">Sök</button>
      </div>
    </form>
    @if (results$ | async; as result) {
      <p class="count">{{ result.total }} personer</p>
      <ul class="members">
        @for (member of result.items; track member.personId) {
          <li>
            <a [routerLink]="['/ledamot', member.personId]"
              ><strong>{{ member.givenName }} {{ member.lastName }}</strong
              ><span>{{ member.partyCode }} · {{ member.constituency }}</span
              ><small>{{ member.status }}</small
              ><b aria-hidden="true">→</b></a
            >
          </li>
        } @empty {
          <li class="empty">Inga träffar. Prova en annan sökning.</li>
        }
      </ul>
      <nav class="pagination" aria-label="Sidindelning">
        @if (result.page > 1) {
          <a [routerLink]="['/']" [queryParams]="{ q: (params$ | async)?.q, page: result.page - 1 }"
            >← Föregående</a
          >
        }
        <span
          >Sida {{ result.page }} av {{ Math.max(1, Math.ceil(result.total / result.limit)) }}</span
        >
        @if (result.page * result.limit < result.total) {
          <a [routerLink]="['/']" [queryParams]="{ q: (params$ | async)?.q, page: result.page + 1 }"
            >Nästa →</a
          >
        }
      </nav>
    } @else {
      <p>Listan kunde inte hämtas. Kontrollera att API och databas körs.</p>
    }
  `,
})
export class MemberListComponent {
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  protected Math = Math;
  params$ = this.route.queryParamMap.pipe(
    map((p) => ({ q: p.get('q') ?? '', page: Math.max(1, Number(p.get('page')) || 1) })),
  );
  results$ = this.params$.pipe(
    switchMap((p) => this.service.list(p.q, p.page)),
    catchError(() => of(null)),
  );
  status$ = this.service.status().pipe(catchError(() => of(null)));
}
