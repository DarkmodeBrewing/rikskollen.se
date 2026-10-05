import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { requestState, type RequestState } from './request-state';
import { MemberService, type DecisionTrail } from './member.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-decision-detail',
  imports: [DatePipe, RouterLink],
  template: `
    <a routerLink="/arenden" class="back">← Ärenden</a>
    @let pageState = trail();
    @if (pageState.status === 'ready') {
      @let data = pageState.data;
      <section class="intro">
        <p class="eyebrow">Ärende · {{ data.document.session }}:{{ data.document.designation }}</p>
        <h1>{{ data.document.title }}</h1>
        <p>
          @if (data.document.decisionDate) {
            Beslutsdatum enligt källan: {{ data.document.decisionDate }}.
          } @else {
            Beslutsdatum saknas i den importerade källan.
          }
        </p>
      </section>
      <aside class="notice">
        Utskottets förslag och uppgifter om beslut per punkt. En huvudvotering visar inte hela
        ärendets beslut.
        <a
          [href]="'https://data.riksdagen.se/dokument/' + data.document.documentId"
          target="_blank"
          rel="noopener"
          >Hela betänkandet ↗</a
        >
        <a [href]="data.sourceUrl" target="_blank" rel="noopener">Dokumentstatus, källa ↗</a>
      </aside>
      <p class="count">{{ data.expectedPoints }} förslagspunkter</p>
      @for (point of data.points; track point.point) {
        <section class="panel decision-point">
          <p class="document-reference">Förslagspunkt {{ point.point }}</p>
          <h2>{{ point.heading || 'Förslagspunkt utan rubrik' }}</h2>
          <p class="proposal">{{ point.proposalText }}</p>
          <p>
            Beslutades genom: {{ point.decisionType || 'uppgift saknas' }}.
            @if (point.winner) {
              Källans vinnare: {{ point.winner }}.
            }
          </p>
          @if (point.sourceVoteId) {
            @if (point.localVoteAvailable) {
              <a [routerLink]="['/votering', point.sourceVoteId]">Visa registrerad votering →</a>
            } @else {
              <a
                [href]="'https://data.riksdagen.se/votering/' + point.sourceVoteId"
                target="_blank"
                rel="noopener"
                >Votering hos Riksdagen ↗</a
              >
            }
          } @else if (point.decisionType.toLowerCase() === 'acklamation') {
            <p>
              Beslut genom acklamation enligt källan; ingen registrerad votering för denna punkt.
            </p>
          } @else {
            <p>Ingen voteringslänk i den importerade dokumentstatusen.</p>
          }
        </section>
      }
      <aside class="notice">
        Källa: Sveriges riksdag · importerad {{ data.importedAt | date: 'yyyy-MM-dd HH:mm' }}.
        Rikskollen är en oberoende tjänst.
      </aside>
    } @else if (pageState.status === 'loading') {
      <p role="status">Hämtar ärende…</p>
    } @else if (pageState.status === 'missing') {
      <p>Inget beslutsunderlag har importerats för detta ärende ännu.</p>
    } @else {
      <p role="alert">Beslutsunderlaget kunde inte hämtas. Försök igen senare.</p>
    }
  `,
})
export class DecisionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemberService);
  readonly trail = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => requestState(this.service.decision(params.get('id') ?? ''), true)),
    ),
    { initialValue: { status: 'loading' } as RequestState<DecisionTrail> },
  );
}
