import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-vote-detail',
  imports: [DatePipe, RouterLink],
  template: `
    <a routerLink="/voteringar" class="back">← Alla voteringar</a>
    @if (detail(); as vote) {
      <section class="intro">
        <p class="eyebrow">Huvudvotering · {{ vote.event.session }}</p>
        <h1>{{ vote.event.designation }} · punkt {{ vote.event.proposalPoint }}</h1>
        <p>
          {{ vote.event.voteDate || 'Datum saknas i källan' }} · {{ vote.event.subjectType }} ·
          {{ vote.event.mainVoteType }}
        </p>
      </section>
      <aside class="notice">
        Den här sidan visar en registrerad huvudvotering, inte hela ärendets beslut. ”Frånvarande”
        avser endast denna votering.
        @if (vote.event.documentId) {
          @if (vote.decisionTrailAvailable) {
            <a [routerLink]="['/arende', vote.event.documentId]">Ärende och beslutspunkter →</a>
          }
          <a
            [href]="'https://data.riksdagen.se/dokument/' + vote.event.documentId"
            target="_blank"
            rel="noopener"
            >Betänkande/dokument ↗</a
          >
        }
        <a [href]="vote.event.sourceUrl" target="_blank" rel="noopener">Voteringens källa ↗</a>
      </aside>
      <section class="panel">
        <h2>Ledamotsröster ({{ vote.total }})</h2>
        <p>
          @for (count of entries(vote.counts); track count[0]) {
            <span class="vote-count">{{ count[0] }}: {{ count[1] }} </span>
          }
        </p>
        <ul class="assignments">
          @for (choice of vote.choices; track choice.personId) {
            <li>
              <span class="choice-name">
                @if (choice.memberProfileAvailable) {
                  <a [routerLink]="['/ledamot', choice.personId]">{{ choice.sourceName }}</a>
                } @else {
                  {{ choice.sourceName }}
                }
                ({{ choice.partyCode }})</span
              >
              <span class="choice-value">{{ choice.choice }}</span>
            </li>
          }
        </ul>
      </section>
      <aside class="notice">
        Källa: Sveriges riksdag · importerad {{ vote.importedAt | date: 'yyyy-MM-dd HH:mm' }}.
        <a [href]="vote.sourceArchiveUrl" target="_blank" rel="noopener">Hela källdatasetet ↗</a>
      </aside>
    } @else {
      <p>Voteringen kunde inte hämtas eller saknas.</p>
    }
  `,
})
export class VoteDetailComponent {
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  detail = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.service.vote(params.get('id') ?? '').pipe(catchError(() => of(null))),
      ),
    ),
    { initialValue: null },
  );
  entries(counts: Record<string, number>) {
    return Object.entries(counts);
  }
}
