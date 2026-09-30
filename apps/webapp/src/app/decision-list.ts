import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { MemberService } from './member.service';

@Component({
  selector: 'app-decision-list',
  imports: [RouterLink],
  template: `
    <section class="intro">
      <p class="eyebrow">Betänkanden · 2025/26</p>
      <h1>Ärenden och beslutspunkter</h1>
      <p>Importerade betänkanden med utskottets förslag och källans uppgift om hur varje punkt beslutades.</p>
    </section>
    @if (result(); as result) {
      @if (result.coverage; as coverage) {
        <aside class="notice">
          Beslutsunderlag finns för {{ coverage.importedDocuments }} av {{ coverage.sourceDocuments }}
          unika betänkanden som hänvisas till av importerade voteringar {{ coverage.session }}.
          {{ coverage.voteEventsWithoutDocument }} voteringar saknar ett verifierat betänkande-ID och ingår inte i nämnaren.
          Betänkanden utan registrerad votering ingår inte heller. Detta är datatäckning, inte ett mått på ledamöter eller beslut.
          <a [href]="coverage.voteSourceUrl" target="_blank" rel="noopener">Voteringsdataset ↗</a>
        </aside>
      } @else {
        <aside class="notice">Ingen slutförd voteringsimport finns att jämföra täckningen med.</aside>
      }
      <p class="count">{{ result.total }} importerade betänkanden</p>
      <ul class="members">
        @for (report of result.items; track report.documentId) {
          <li><a [routerLink]="['/arende', report.documentId]">
            <strong>{{ report.session }}:{{ report.designation }} · {{ report.title }}</strong>
            <span>{{ report.decisionDate || 'Beslutsdatum saknas' }}</span>
            <small>{{ report.pointCount }} beslutspunkter</small><b aria-hidden="true">→</b>
          </a></li>
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
    } @else {
      <p>Beslutsunderlagen kunde inte hämtas.</p>
    }
  `,
})
export class DecisionListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemberService);
  readonly result = toSignal(this.route.queryParamMap.pipe(
    map((params) => Math.max(1, Number(params.get('page')) || 1)),
    switchMap((page) => this.service.decisions(page).pipe(catchError(() => of(null)))),
  ), { initialValue: null });
  pages(total: number, limit: number) {
    return Math.max(1, Math.ceil(total / limit));
  }
}
