import { bindPageMetadata } from './page-metadata';
import { DatePipe } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { requestState, type RequestState } from './request-state';
import { MemberService, type Member } from './member.service';
import { VoteHistoryComponent } from './vote-history';

@Component({
  selector: 'app-member-detail',
  imports: [DatePipe, RouterLink, VoteHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/" class="back">← Alla ledamöter</a>
    @let state = member();
    @if (state.status === 'ready') {
      @let member = state.data;
      <section class="intro member-intro">
        <p class="eyebrow">Ledamotsprofil · {{ member.partyCode }}</p>
        <h1>{{ member.givenName }} {{ member.lastName }}</h1>
        <p>{{ member.constituency }} · {{ member.status }}</p>
      </section>
      <section class="panel">
        <h2>Uppdrag i källan</h2>
        <p>
          Historiska och pågående uppdrag visas med källans datumtext. Tiderna saknar angiven
          tidszon.
        </p>
        <ul class="assignments profile-assignments">
          @for (item of member.assignments; track $index) {
            <li>
              <strong>{{ item.roleCode }}</strong> · {{ item.value || item.organCode }}
              <span
                >{{ item.from || 'Okänt startdatum' }} –
                {{ item.to || 'Inget slutdatum angivet' }}</span
              >
            </li>
          } @empty {
            <li>Inga uppdrag i denna källpost.</li>
          }
        </ul>
      </section>
      <app-vote-history />
      <aside class="notice">
        Hämtad {{ member.fetchedAt | date: 'yyyy-MM-dd HH:mm' }}. Källa: Sveriges riksdag.
        <a [href]="member.personUrl || member.sourceUrl" target="_blank" rel="noopener"
          >Visa originalpost ↗</a
        >
      </aside>
    } @else if (state.status === 'loading') {
      <p role="status">Hämtar ledamotsprofil…</p>
    } @else if (state.status === 'missing') {
      <p>Profilen saknas i den senaste ledamotsimporten.</p>
    } @else {
      <p role="alert">Profilen kunde inte hämtas. Försök igen senare.</p>
    }
  `,
})
export class MemberDetailComponent {
  constructor() {
    bindPageMetadata(() =>
      (() => {
        const state = this.member();
        if (state.status !== 'ready')
          return {
            title: state.status === 'missing' ? 'Ledamotsprofil saknas' : 'Ledamotsprofil',
            description: 'Utforska riksdagens ledamöter, uppdrag och registrerade röster.',
            indexable: false,
          };
        const person = state.data;
        return {
          title: `${person.givenName} ${person.lastName} – ledamotsprofil`,
          description: `${person.givenName} ${person.lastName} (${person.partyCode}), ${person.constituency}. Se uppdrag och registrerade röster med källor från Sveriges riksdag.`,
        };
      })(),
    );
  }

  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemberService);
  readonly member = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('id') ?? ''),
      distinctUntilChanged(),
      switchMap((id) => requestState(this.service.get(id), true)),
    ),
    { initialValue: { status: 'loading' } as RequestState<Member> },
  );
}
