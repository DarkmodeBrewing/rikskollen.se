import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { bindPageMetadata } from './page-metadata';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class AboutComponent {
  constructor() {
    bindPageMetadata(() => ({
      title: 'Om Rikskollen',
      description:
        'Så använder Rikskollen riksdagens öppna data: källor, beräkningar, täckning, integritet och AI-assisterad utveckling. En oberoende tjänst.',
    }));
  }
}
