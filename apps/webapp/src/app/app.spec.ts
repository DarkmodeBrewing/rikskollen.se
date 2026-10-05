import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders navigation and independent source attribution', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const navigation = compiled.querySelector('nav[aria-label="Huvudnavigation"]');
    expect(
      Array.from(navigation!.querySelectorAll('a'), (link) => link.getAttribute('href')),
    ).toEqual(['/', '/voteringar', '/arenden']);
    expect(compiled.querySelector('footer')?.textContent).toContain('Källa: Sveriges riksdag');
    expect(compiled.querySelector('footer')?.textContent).toContain('oberoende');
  });
});
