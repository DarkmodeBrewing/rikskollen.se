import { TestBed } from '@angular/core/testing';
import { VoteChoiceChartComponent } from './vote-choice-chart';

describe('VoteChoiceChartComponent', () => {
  it('keeps unknown source values and exact counts on a shared total scale', async () => {
    const fixture = TestBed.createComponent(VoteChoiceChartComponent);
    fixture.componentRef.setInput('choices', [
      { choice: 'Ja', count: 3 },
      { choice: 'Frånvarande', count: 1 },
      { choice: '', count: 1 },
    ]);
    fixture.componentRef.setInput('total', 5);
    fixture.componentRef.setInput('session', '2025/26');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Okänt källvärde');
    expect(element.textContent).toContain('5 totalt');
    expect(
      Array.from(element.querySelectorAll<HTMLElement>('.bar'), (bar) => bar.style.width),
    ).toEqual(['60%', '20%', '20%']);
    expect(Array.from(element.querySelectorAll('strong'), (count) => count.textContent)).toEqual([
      '3',
      '1',
      '1',
    ]);
  });

  it('describes an empty snapshot without drawing a distribution', async () => {
    const fixture = TestBed.createComponent(VoteChoiceChartComponent);
    fixture.componentRef.setInput('choices', []);
    fixture.componentRef.setInput('total', 0);
    fixture.componentRef.setInput('session', '2025/26');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Ingen fördelning kan visas');
    expect(fixture.nativeElement.querySelector('.bar')).toBeNull();
  });
});
