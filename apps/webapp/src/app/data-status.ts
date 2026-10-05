import { StockholmDatePipe } from './stockholm-date';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import type {
  DataStatus,
  ImportDataset,
  ImportJob,
  PublicImportAttempt,
} from '../../../../packages/shared-types/src/data-status';
import { MemberService } from './member.service';
import { requestState, type RequestState } from './request-state';
import { bindPageMetadata } from './page-metadata';

const datasets: Record<ImportDataset, { title: string; unit: string; explanation: string }> = {
  members: {
    title: 'Ledamöter',
    unit: 'ledamöter',
    explanation: 'Den senast slutförda tjänstgöringslistan. Äldre personposter räknas inte in.',
  },
  votes: {
    title: 'Registrerade voteringar',
    unit: 'voteringar',
    explanation:
      'Varje validerad fil i det importerade sessionsarkivet är en votering. Beslut utan registrerad votering ingår inte.',
  },
  catalog: {
    title: 'Beslutade betänkanden',
    unit: 'betänkanden',
    explanation:
      'Den senast slutförda dokumentlistan för 2025/26. Betänkanden som inte är markerade som beslutade ingår inte.',
  },
  decisions: {
    title: 'Beslutsunderlag',
    unit: 'betänkanden',
    explanation:
      'Unika betänkanden i den senaste katalogen med slutförd statusimport för 2025/26. Bara senaste versionen räknas; övriga betänkandens beslutspunkter är okända.',
  },
};
const jobs: Record<ImportJob, string> = {
  persons: 'Ledamotslista',
  votes: 'Voteringsarkiv',
  'report-catalog': 'Betänkandekatalog',
  decision: 'Enskilt beslutsunderlag',
  'catalog-decisions': 'Beslutsunderlag från katalog',
  'vote-linked-decisions': 'Beslutsunderlag från voteringar',
};

@Component({
  selector: 'app-data-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StockholmDatePipe, DecimalPipe],
  template: `
    <section class="intro">
      <p class="eyebrow">Källor · Täckning · Uppdateringar</p>
      <h1>Datastatus</h1>
      <p>Se vilka uppgifter som finns i Rikskollen, när de importerades och hur importerna gick.</p>
    </section>
    @let state = result();
    @if (state.status === 'ready') {
      @let data = state.data;
      <aside class="notice">
        Importerna startas manuellt. Schemalagda uppdateringar är ännu inte aktiverade. Ett nytt
        importförsök ändrar inte tidpunkten för den senast slutförda dataimporten. Misslyckade
        importer publicerar ingen ofullständig ögonblicksbild; redan slutförda betänkanden i en
        avbruten batch behålls.
      </aside>
      <section aria-labelledby="coverage-title">
        <h2 id="coverage-title">Importerade uppgifter</h2>
        <div class="status-grid">
          @for (key of keys; track key) {
            @let info = datasets[key];
            @let snapshot = coverage(data, key);
            <article class="panel status-card" [attr.aria-labelledby]="'coverage-' + key">
              <p class="eyebrow">
                {{ snapshot?.session || (key === 'members' ? 'Tjänstgöringslista' : '2025/26') }}
              </p>
              <h3 [id]="'coverage-' + key">{{ info.title }}</h3>
              @if (snapshot) {
                <p class="status-number">
                  {{ snapshot.importedCount | number: '1.0-0' : 'sv' }}
                  <span>av {{ snapshot.expectedCount | number: '1.0-0' : 'sv' }}</span>
                </p>
                <p>{{ unit(key, snapshot.importedCount) }} i källans importerade urval</p>
                @if (snapshot.expectedCount > 0) {
                  <progress
                    [value]="snapshot.importedCount"
                    [max]="snapshot.expectedCount"
                    [attr.aria-label]="
                      info.title + ': ' + snapshot.importedCount + ' av ' + snapshot.expectedCount
                    "
                  ></progress>
                }
                <p class="status-tag">
                  {{
                    snapshot.complete
                      ? 'Urvalet är fullständigt importerat'
                      : 'Urvalet är inte fullständigt importerat'
                  }}
                </p>
                @if (key === 'decisions') {
                  <p>
                    {{ snapshot.expectedCount - snapshot.importedCount }}
                    {{ unit('decisions', snapshot.expectedCount - snapshot.importedCount) }} saknar
                    beslutsunderlag.
                  </p>
                  <dl class="status-times">
                    <dt>Äldsta importerade underlag</dt>
                    <dd>
                      {{
                        snapshot.oldestSuccessfulAt
                          ? (snapshot.oldestSuccessfulAt | stockholmDate)
                          : 'Ingen slutförd import'
                      }}
                    </dd>
                    <dt>Senast importerade underlag</dt>
                    <dd>
                      {{
                        snapshot.lastSuccessfulAt
                          ? (snapshot.lastSuccessfulAt | stockholmDate)
                          : 'Ingen slutförd import'
                      }}
                    </dd>
                  </dl>
                } @else {
                  <p>
                    Senast slutförd dataimport<br /><strong>{{
                      snapshot.lastSuccessfulAt | stockholmDate
                    }}</strong>
                  </p>
                }
                @if (snapshot.secondaryCount !== null) {
                  <p>
                    {{ snapshot.secondaryCount | number: '1.0-0' : 'sv' }}
                    {{
                      key === 'votes'
                        ? snapshot.secondaryCount === 1
                          ? 'individuell röstrad'
                          : 'individuella röstrader'
                        : snapshot.secondaryCount === 1
                          ? 'importerad beslutspunkt'
                          : 'importerade beslutspunkter'
                    }}
                  </p>
                }
                <a [href]="snapshot.sourceUrl" target="_blank" rel="noopener"
                  >Källa: Sveriges riksdag ↗</a
                >
              } @else {
                <p class="empty">
                  {{
                    key === 'decisions'
                      ? 'Ingen slutförd katalog att jämföra beslutsunderlagen med.'
                      : 'Ingen slutförd import ännu.'
                  }}
                </p>
              }
              <p class="status-explanation">{{ info.explanation }}</p>
            </article>
          }
        </div>
      </section>
      <section class="panel" aria-labelledby="attempts-title">
        <h2 id="attempts-title">Senaste försök per importjobb</h2>
        <p>
          Resultatet gäller ett importförsök, inte hela datamängdens aktualitet. En batch och dess
          enskilda betänkanden visas som separata jobb.
        </p>
        <ul class="status-runs">
          @for (attempt of data.latestAttempts; track attempt.job) {
            <li>
              <strong>{{ jobs[attempt.job] }}</strong
              ><span>{{ outcome(attempt) }}</span>
              <time [attr.datetime]="attempt.startedAt">{{
                attempt.startedAt | stockholmDate
              }}</time>
            </li>
          } @empty {
            <li>Inga importförsök har registrerats ännu.</li>
          }
        </ul>
      </section>
      <section class="panel" aria-labelledby="history-title">
        <h2 id="history-title">Importhistorik</h2>
        <p>
          Historik registreras från
          {{
            data.trackingStartedAt
              ? (data.trackingStartedAt | stockholmDate)
              : 'nästa importförsök'
          }}. Äldre slutförda dataimporter visas i täckningen ovan. Tidigare misslyckade försök kan
          inte återskapas.
        </p>
        <ol class="status-history">
          @for (attempt of data.history.items; track attempt.id) {
            <li>
              <div>
                <h3>{{ jobs[attempt.job] }}</h3>
                <p>
                  {{ attempt.session || 'Tjänstgöringslista' }}
                  @if (attempt.documentId) {
                    · {{ attempt.documentId }}
                  }
                </p>
              </div>
              <div>
                <strong>{{ outcome(attempt) }}</strong>
                <p>
                  Start:
                  <time [attr.datetime]="attempt.startedAt">{{
                    attempt.startedAt | stockholmDate: true
                  }}</time>
                </p>
                @if (attempt.finishedAt) {
                  <p>
                    Slut: {{ attempt.finishedAt | stockholmDate: true }} ·
                    {{ attempt.durationSeconds | number: '1.0-1' : 'sv' }} sekunder
                  </p>
                }
                <p>
                  {{ attempt.importedCount }}
                  {{ attempt.importedCount === 1 ? 'publicerad' : 'publicerade' }}
                  {{ unit(attempt.dataset, attempt.importedCount) }} i detta försök
                  @if (attempt.expectedCount !== null) {
                    av {{ attempt.expectedCount }}
                    {{ attempt.expectedCount === 1 ? 'planerad' : 'planerade' }}.
                  } @else {
                    · Planerat antal är okänt.
                  }
                </p>
                @if (attempt.status === 'failed') {
                  <p>Importen kunde inte slutföras. Tekniska detaljer finns i serverns loggar.</p>
                }
                @if (attempt.status === 'running') {
                  <p>Ingen slutstatus har registrerats. Jobbet kan pågå eller ha avbrutits.</p>
                }
              </div>
            </li>
          } @empty {
            <li>Inga registrerade försök på denna sida.</li>
          }
        </ol>
        <nav class="pagination" aria-label="Importhistorikens sidor">
          @if (data.history.page > 1) {
            <a routerLink="/datastatus" [queryParams]="{ page: data.history.page - 1 }"
              >← Föregående</a
            >
          }
          <span>Sida {{ data.history.page }} av {{ pages(data.history.total) }}</span>
          @if (data.history.page * 20 < data.history.total) {
            <a routerLink="/datastatus" [queryParams]="{ page: data.history.page + 1 }">Nästa →</a>
          }
        </nav>
      </section>
      <section class="panel" aria-labelledby="method-title">
        <h2 id="method-title">Så ska uppgifterna läsas</h2>
        <p>
          Täckningen jämför importerade poster med källans urval vid hämtningen. Den visar inte hur
          stor del av all parlamentarisk verksamhet som finns här eller om källan har ändrats sedan
          dess. Tider visas i svensk tid.
        </p>
        <p>
          Voteringar är registrerade omröstningar. Frånvarande gäller en viss votering och säger
          inget om dagar på arbetet. Beslut genom acklamation finns i beslutsunderlagen när de
          importerats.
        </p>
        <p>
          Källreferenser, hämtningstider och kontrollsummor sparas. Tidigare versioner av voteringar
          och beslutsunderlag behålls, men råa källsvar arkiveras inte och en kontrollsumma kan inte
          återskapa dem.
        </p>
        <a
          href="https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/"
          target="_blank"
          rel="noopener"
          >Riksdagens öppna data ↗</a
        >
        ·
        <a
          href="https://github.com/DarkmodeBrewing/rikskollen.se/blob/main/docs/data-methodology.md"
          target="_blank"
          rel="noopener"
          >Rikskollens metodbeskrivning ↗</a
        >
        <p>Uppgifterna hämtades: {{ data.generatedAt | stockholmDate }}.</p>
        <button type="button" (click)="refresh()">Uppdatera datastatus</button>
      </section>
    } @else if (state.status === 'loading') {
      <p role="status">Hämtar datastatus…</p>
    } @else {
      <section class="panel">
        <p role="alert">Datastatus kunde inte hämtas.</p>
        <button type="button" (click)="refresh()">Försök igen</button>
      </section>
    }
  `,
})
export class DataStatusComponent {
  private readonly service = inject(MemberService);
  private readonly route = inject(ActivatedRoute);
  private readonly reload = signal(0);
  readonly datasets = datasets;
  readonly jobs = jobs;
  readonly keys: ImportDataset[] = ['members', 'votes', 'catalog', 'decisions'];
  readonly result = toSignal(
    combineLatest([this.route.queryParamMap, toObservable(this.reload)]).pipe(
      map(([params]) => Math.max(1, Number(params.get('page')) || 1)),
      switchMap((page) => requestState(this.service.dataStatus(page))),
    ),
    { initialValue: { status: 'loading' } as RequestState<DataStatus> },
  );
  constructor() {
    bindPageMetadata(() => ({
      title: 'Datastatus',
      description:
        'Se Rikskollens datatäckning, senaste slutförda importer och importhistorik för ledamöter, voteringar och betänkanden.',
      indexable: this.result().status === 'ready',
    }));
  }
  coverage(data: DataStatus, key: ImportDataset) {
    return data.coverage.find((row) => row.dataset === key);
  }
  unit(key: ImportDataset, count: number) {
    return count === 1
      ? { members: 'ledamot', votes: 'votering', catalog: 'betänkande', decisions: 'betänkande' }[
          key
        ]
      : datasets[key].unit;
  }
  outcome(attempt: PublicImportAttempt) {
    return { running: 'Slutstatus saknas', succeeded: 'Slutförd', failed: 'Misslyckad' }[
      attempt.status
    ];
  }
  pages(total: number) {
    return Math.max(1, Math.ceil(total / 20));
  }
  refresh() {
    this.reload.update((value) => value + 1);
  }
}
