import { bindPageMetadata } from './page-metadata';
import { DatePipe } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { requestState, type RequestState } from './request-state';
import { MemberService, type ImportStatus, type MemberList } from './member.service';

@Component({
  selector: 'app-member-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="intro member-intro">
      <p class="eyebrow">Ledamöter</p>
      <h1>Utforska riksdagens ledamöter</h1>
      <p>
        Sök bland personer i den senast importerade tjänstgörande listan. Uppdrag och status återges
        som de står i källan.
      </p>
    </section>
    @let statusState = importStatus();
    @if (statusState.status === 'ready') {
      @if (statusState.data; as status) {
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
    } @else if (statusState.status === 'loading') {
      <aside class="notice" role="status">Hämtar importstatus…</aside>
    } @else {
      <aside class="notice" role="alert">Importstatus kunde inte hämtas.</aside>
    }
    <form action="/" method="get" class="search">
      <label for="q">Sök namn, parti eller valkrets</label>
      <div>
        <input id="q" name="q" [value]="params().q" placeholder="Till exempel Stockholm" /><button
          type="submit"
        >
          Sök
        </button>
      </div>
    </form>
    @let resultState = results();
    @if (resultState.status === 'ready') {
      @let result = resultState.data;
      <p class="count">{{ result.total }} personer</p>
      <ul class="members member-directory">
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
          <a [routerLink]="['/']" [queryParams]="{ q: params().q, page: result.page - 1 }"
            >← Föregående</a
          >
        }
        <span
          >Sida {{ result.page }} av {{ Math.max(1, Math.ceil(result.total / result.limit)) }}</span
        >
        @if (result.page * result.limit < result.total) {
          <a [routerLink]="['/']" [queryParams]="{ q: params().q, page: result.page + 1 }"
            >Nästa →</a
          >
        }
      </nav>
    } @else if (resultState.status === 'loading') {
      <p role="status">Hämtar ledamöter…</p>
    } @else {
      <p role="alert">Listan kunde inte hämtas. Kontrollera att API och databas körs.</p>
    }
  `,
})
export class MemberListComponent {
  constructor() {
    bindPageMetadata(() => ({
      title: 'Ledamöter',
      description:
        'Sök bland riksdagens ledamöter. Utforska uppdrag och registrerade röster med tydliga källor och datatäckning.',
      indexable: this.results().status === 'ready',
    }));
  }

  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemberService);
  protected readonly Math = Math;
  private readonly params$ = this.route.queryParamMap.pipe(
    map((params) => ({
      q: params.get('q') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    })),
    distinctUntilChanged(
      (previous, current) => previous.q === current.q && previous.page === current.page,
    ),
  );
  readonly params = toSignal(this.params$, { initialValue: { q: '', page: 1 } });
  readonly results = toSignal(
    this.params$.pipe(switchMap(({ q, page }) => requestState(this.service.list(q, page)))),
    { initialValue: { status: 'loading' } as RequestState<MemberList> },
  );
  readonly importStatus = toSignal(requestState(this.service.status()), {
    initialValue: { status: 'loading' } as RequestState<ImportStatus | null>,
  });
}
