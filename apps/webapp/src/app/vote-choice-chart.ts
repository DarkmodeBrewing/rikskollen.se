import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-vote-choice-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure aria-labelledby="choice-chart-heading">
      <figcaption id="choice-chart-heading">Fördelning av källans noteringar</figcaption>
      <p>Antal källposter · {{ total() }} totalt · session {{ session() }}</p>
      @if (total() > 0) {
        <ul aria-label="Antal källposter per röstvärde">
          @for (group of choices(); track group.choice) {
            <li>
              <div class="label">
                <span>{{ group.choice || 'Okänt källvärde' }}</span
                ><strong>{{ group.count }}</strong>
              </div>
              <div class="track" aria-hidden="true">
                <div
                  class="bar"
                  [class.absent]="group.choice === 'Frånvarande'"
                  [class.other]="!knownChoices.has(group.choice)"
                  [style.width.%]="(100 * group.count) / total()"
                ></div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <p>Inga källposter för personens ID i denna import. Ingen fördelning kan visas.</p>
      }
      <p class="explanation">
        Varje stapel visar antal poster med det angivna källvärdet, på samma skala från 0 till
        {{ total() }}. Frånvarande gäller enskilda voteringar. Fördelningen visar inte närvaro i
        arbetet.
      </p>
    </figure>
  `,
  styles: [
    `
      :host {
        display: block;
        margin: 28px 0;
      }
      figure {
        margin: 0;
        padding: 28px;
        background: #f7f5ef;
        border: 1px solid #d9dfd7;
      }
      figcaption {
        font-size: 18px;
        font-weight: 750;
      }
      p {
        margin: 8px 0 24px;
        color: #52635d;
        font-size: 14px;
        line-height: 1.65;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 20px;
      }
      .label {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }
      .label span {
        overflow-wrap: anywhere;
      }
      .track {
        height: 12px;
        background: #e1e7df;
        border-radius: 3px;
        overflow: hidden;
      }
      .bar {
        height: 100%;
        background: #087963;
      }
      .bar.absent {
        background: #64746d;
      }
      .bar.other {
        background: #8a6326;
      }
      .explanation {
        margin: 24px 0 0;
        max-width: 70ch;
      }
      @media (max-width: 700px) {
        figure {
          padding: 20px 16px;
        }
      }
    `,
  ],
})
export class VoteChoiceChartComponent {
  readonly choices = input.required<ReadonlyArray<{ choice: string; count: number }>>();
  readonly total = input.required<number>();
  readonly session = input.required<string>();
  protected readonly knownChoices = new Set(['Ja', 'Nej', 'Avstår', 'Frånvarande']);
}
