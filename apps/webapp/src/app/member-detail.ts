import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  selector: 'app-member-detail',
  imports: [AsyncPipe, DatePipe, RouterLink],
  template: `
    <a routerLink="/" class="back">← Alla ledamöter</a>
    @if (member$ | async; as member) {
      <section class="intro">
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
        <ul class="assignments">
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
      <aside class="notice">
        Hämtad {{ member.fetchedAt | date: 'yyyy-MM-dd HH:mm' }}. Källa: Sveriges riksdag.
        <a [href]="member.personUrl || member.sourceUrl" target="_blank" rel="noopener"
          >Visa originalpost ↗</a
        >
      </aside>
    } @else {
      <p>Profilen kunde inte hämtas eller saknas.</p>
    }
  `,
})
export class MemberDetailComponent {
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  member$ = this.route.paramMap.pipe(
    switchMap((p) => this.service.get(p.get('id') ?? '')),
    catchError(() => of(null)),
  );
}
