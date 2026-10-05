import { bindPageMetadata } from './page-metadata';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { requestState, type RequestState } from './request-state';
import { MemberService, type DecisionList } from './member.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-decision-list',
  imports: [RouterLink],
  template: `
    <section class="intro">
      <p class="eyebrow">Betänkanden · 2025/26</p>
      <h1>Ärenden och beslutspunkter</h1>
      <p>
        Importerade betänkanden med utskottets förslag och källans uppgift om hur varje punkt
        beslutades.
      </p>
    </section>
    @let pageState = result();
    @if (pageState.status === 'ready') {
      @let result = pageState.data;
      @if (result.catalogCoverage; as catalog) {
        <aside class="notice">
          Beslutsunderlag finns för {{ catalog.importedDocuments }} av
          {{ catalog.sourceDocuments }} betänkanden markerade som beslutade i dokumentlistan för
          {{ catalog.session }}.
          @if (catalog.withRecordedVote !== null) {
            {{ catalog.sourceDocuments - catalog.withRecordedVote }} av dessa betänkanden saknar en
            registrerad votering i det importerade voteringsdatasetet. Det innebär inte att alla
            beslutspunkter saknar votering.
          }
          Dokument som inte är markerade som beslutade ingår inte i nämnaren.
          <a [href]="catalog.catalogSourceUrl" target="_blank" rel="noopener">Dokumentlista ↗</a>
        </aside>
      } @else {
        <aside class="notice">Ingen fullständig import av beslutade betänkanden ännu.</aside>
      }
      @if (result.decisionMethodSummary; as summary) {
        <section class="panel method-summary" aria-labelledby="decision-method-heading">
          <h2 id="decision-method-heading">Beslutssätt i importerade betänkanden</h2>
          @if (summary.totalPoints > 0) {
            <p>
              Av {{ summary.totalPoints }} beslutspunkter i {{ summary.importedDocuments }} av
              {{ summary.sourceDocuments }} betänkanden markerade som beslutade
              {{ summary.session }} anger källan:
            </p>
            <ul class="method-counts">
              <li>Röstning: {{ summary.counts.recordedVote }}</li>
              <li>Acklamation: {{ summary.counts.acclamation }}</li>
              <li>Annan beslutstyp: {{ summary.counts.other }}</li>
              <li>Beslutstyp saknas: {{ summary.counts.unknown }}</li>
            </ul>
            @if (summary.counts.other > 0) {
              <p>
                Övriga källvärden:
                @for (method of summary.sourceValues; track method.sourceValue) {
                  @if (
                    method.sourceValue &&
                    method.sourceValue.trim().toLowerCase() !== 'röstning' &&
                    method.sourceValue.trim().toLowerCase() !== 'acklamation'
                  ) {
                    <span>{{ method.sourceValue }} ({{ method.count }}) </span>
                  }
                }
              </p>
            }
          } @else {
            <p>Inga beslutspunkter har importerats från katalogens betänkanden ännu.</p>
          }
          <p>
            {{ summary.excludedDocuments }} katalogbetänkanden saknar importerat beslutsunderlag och
            deras beslutspunkter ingår inte. Uppgifterna gäller importerade beslutspunkter, inte
            alla riksdagens beslut eller ledamöters närvaro.
            <a [href]="summary.catalogSourceUrl" target="_blank" rel="noopener"
              >Källa: Sveriges riksdags dokumentlista ↗</a
            >
          </p>
        </section>
      }
      @if (result.coverage; as coverage) {
        <aside class="notice">
          Beslutsunderlag finns för {{ coverage.importedDocuments }} av
          {{ coverage.sourceDocuments }} unika betänkanden som hänvisas till av importerade
          voteringar {{ coverage.session }}. {{ coverage.voteEventsWithoutDocument }} voteringar
          saknar ett verifierat betänkande-ID och ingår inte i nämnaren. Betänkanden utan
          registrerad votering ingår inte heller. Detta är datatäckning, inte ett mått på ledamöter
          eller beslut.
          <a [href]="coverage.voteSourceUrl" target="_blank" rel="noopener">Voteringsdataset ↗</a>
        </aside>
      } @else {
        <aside class="notice">
          Ingen slutförd voteringsimport finns att jämföra täckningen med.
        </aside>
      }
      <p class="count">{{ result.total }} importerade betänkanden</p>
      <ul class="members document-list">
        @for (report of result.items; track report.documentId) {
          <li>
            <a [routerLink]="['/arende', report.documentId]">
              <div class="list-main">
                <strong>{{ report.title }}</strong>
                <small>{{ report.session }}:{{ report.designation }}</small>
                <span
                  >{{ report.pointCount }} beslutspunkter ·
                  {{ report.decisionDate || 'Beslutsdatum saknas' }}</span
                >
              </div>
              <b aria-hidden="true">→</b>
            </a>
          </li>
        } @empty {
          <li class="empty">Inga betänkanden importerade.</li>
        }
      </ul>
      <nav class="pagination" aria-label="Sidindelning">
        @if (result.page > 1) {
          <a routerLink="/arenden" [queryParams]="{ page: result.page - 1 }">← Föregående</a>
        }
        <span>Sida {{ result.page }} av {{ pages(result.total, result.limit) }}</span>
        @if (result.page * result.limit < result.total) {
          <a routerLink="/arenden" [queryParams]="{ page: result.page + 1 }">Nästa →</a>
        }
      </nav>
    } @else if (pageState.status === 'loading') {
      <p role="status">Hämtar beslutsunderlag…</p>
    } @else {
      <p role="alert">Beslutsunderlagen kunde inte hämtas.</p>
    }
  `,
})
export class DecisionListComponent {
  constructor() {
    bindPageMetadata(() => ({
      title: 'Ärenden och beslutspunkter',
      description:
        'Läs importerade betänkanden, utskottets förslag och källans uppgifter om hur varje beslutspunkt beslutades.',
      indexable: this.result().status === 'ready',
    }));
  }

  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemberService);
  readonly result = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => Math.max(1, Number(params.get('page')) || 1)),
      switchMap((page) => requestState(this.service.decisions(page))),
    ),
    { initialValue: { status: 'loading' } as RequestState<DecisionList> },
  );
  pages(total: number, limit: number) {
    return Math.max(1, Math.ceil(total / limit));
  }
}
