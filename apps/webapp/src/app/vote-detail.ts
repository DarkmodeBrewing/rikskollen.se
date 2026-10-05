import { bindPageMetadata } from './page-metadata';
import { VoteChoiceChartComponent } from './vote-choice-chart';
import { voteLabel } from './vote-label';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { requestState, type RequestState } from './request-state';
import { MemberService, type VoteDetail } from './member.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vote-detail',
  imports: [DatePipe, RouterLink, VoteChoiceChartComponent],
  template: `
    <a routerLink="/voteringar" class="back">← Alla voteringar</a>
    @let pageState = detail();
    @if (pageState.status === 'ready') {
      @let vote = pageState.data;
      <section class="intro">
        <p class="eyebrow">Huvudvotering · {{ vote.event.session }}</p>
        <h1>{{ voteLabel(vote.event) }}</h1>
        @if (vote.event.context?.pointHeading && vote.event.context?.reportTitle) {
          <p>{{ vote.event.context?.reportTitle }}</p>
        }
        <p class="document-reference">
          {{ vote.event.session }}:{{ vote.event.designation }} · punkt
          {{ vote.event.proposalPoint }}
        </p>
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
      @if (vote.event.context; as context) {
        @if (context.titleSourceUrl) {
          <aside class="notice">
            Rubrik från Sveriges riksdag · hämtad
            {{ context.titleImportedAt | date: 'yyyy-MM-dd HH:mm' }}.
            <a [href]="context.titleSourceUrl" target="_blank" rel="noopener">Rubrikens källa ↗</a>
            @if (context.pointHeading && context.pointSourceUrl) {
              <a [href]="context.pointSourceUrl" target="_blank" rel="noopener"
                >Punktrubrikens källa ↗</a
              >
            } @else {
              Punktrubrik saknas för denna votering i det importerade underlaget.
            }
          </aside>
        }
      }
      <section class="panel">
        <h2>Ledamotsröster ({{ vote.total }})</h2>
        <app-vote-choice-chart
          mode="vote"
          [choices]="chartChoices(vote.counts)"
          [total]="vote.total"
          [session]="vote.event.session"
        />
        <ul class="assignments vote-choices">
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
    } @else if (pageState.status === 'loading') {
      <p role="status">Hämtar votering…</p>
    } @else if (pageState.status === 'missing') {
      <p>Voteringen saknas i den senaste importen.</p>
    } @else {
      <p role="alert">Voteringen kunde inte hämtas. Försök igen senare.</p>
    }
  `,
})
export class VoteDetailComponent {
  constructor() {
    bindPageMetadata(() =>
      (() => {
        const state = this.detail();
        if (state.status !== 'ready')
          return {
            title: state.status === 'missing' ? 'Votering saknas' : 'Votering',
            description:
              'Utforska registrerade voteringar med röstfördelning och källor från Sveriges riksdag.',
            indexable: false,
          };
        const event = state.data.event;
        const topic = voteLabel(event);
        const report =
          event.context?.pointHeading && event.context?.reportTitle
            ? ` ${event.context.reportTitle}.`
            : '';
        return {
          title: `${topic}${event.context?.pointHeading && event.context?.reportTitle ? ` – ${event.context.reportTitle}` : ''} – votering`,
          description: `${topic}.${report} Punkt ${event.proposalPoint}, riksmöte ${event.session}. Se registrerade röster och källor. Frånvarande gäller endast denna votering.`,
        };
      })(),
    );
  }

  protected readonly voteLabel = voteLabel;
  private route = inject(ActivatedRoute);
  private service = inject(MemberService);
  detail = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => requestState(this.service.vote(params.get('id') ?? ''), true)),
    ),
    { initialValue: { status: 'loading' } as RequestState<VoteDetail> },
  );
  chartChoices(counts: Record<string, number>) {
    return Object.entries(counts).map(([choice, count]) => ({ choice, count }));
  }
}
