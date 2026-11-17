import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { StockholmDatePipe } from './stockholm-date';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import type { Overview } from '../../../../packages/shared-types/src/overview';
import { MemberService } from './member.service';
import { bindPageMetadata } from './page-metadata';
import { requestState, type RequestState } from './request-state';

@Component({
  selector: 'app-home',
  imports: [RouterLink, StockholmDatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  private readonly service = inject(MemberService);
  private readonly reload = signal(0);
  readonly result = toSignal(
    toObservable(this.reload).pipe(switchMap(() => requestState(this.service.overview()))),
    {
      initialValue: { status: 'loading' } as RequestState<Overview>,
    },
  );
  constructor() {
    bindPageMetadata(() => ({
      title: 'Utforska riksdagens beslut',
      description:
        'Utforska ledamöter, registrerade voteringar och beslutade betänkanden för 2025/26. Källänkade sammanställningar med tydlig täckning och metod.',
    }));
  }
  refresh() {
    this.reload.update((value) => value + 1);
  }
}
