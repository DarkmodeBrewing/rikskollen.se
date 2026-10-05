import { StockholmDatePipe } from './stockholm-date';

describe('Swedish import timestamps', () => {
  const pipe = new StockholmDatePipe();
  it('uses Stockholm daylight saving in SSR and browsers', () => {
    expect(pipe.transform('2026-01-01T12:00:00Z')).toContain('13:00');
    expect(pipe.transform('2026-07-01T12:00:00Z')).toContain('14:00');
    expect(pipe.transform(null)).toBe('—');
  });
});
