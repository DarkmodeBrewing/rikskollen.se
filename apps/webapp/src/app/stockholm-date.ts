import { Pipe, type PipeTransform } from '@angular/core';

// Intl supports Swedish daylight saving rules consistently in SSR and browsers.
@Pipe({ name: 'stockholmDate' })
export class StockholmDatePipe implements PipeTransform {
  transform(value: string | null, seconds = false): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(seconds ? ({ second: '2-digit' } as const) : {}),
    }).format(new Date(value));
  }
}
