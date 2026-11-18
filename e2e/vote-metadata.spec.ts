import { test, expect } from './fixtures';
import { member } from './data';
test('vote metadata supplies source title/date without inventing a report link', async ({ page, app, request }) => {
  app.scenario = 'vote-details';
  const html = await (await request.get(`${app.url}/votering/test-vote-1`)).text();
  expect(html).toContain('Omröstning: Källans kompletterande rubrik');
  expect(html).toContain('2026-03-11');
  await page.goto('/voteringar');
  const link = page.getByRole('link').filter({ hasText: 'Omröstning: Källans kompletterande rubrik' });
  await expect(link).toContainText('2026-03-11');
  await link.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Omröstning: Källans kompletterande rubrik');
  await expect(page.getByText('saknas i arkivet', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kompletterande källa' })).toHaveAttribute('href', 'https://data.riksdagen.se/votering/test-vote-1/json');
  await expect(page.getByRole('link', { name: 'Ärende och beslutspunkter' })).toHaveCount(0);
  await page.goto(`/ledamot/${member.personId}`);
  await expect(page.getByRole('link', { name: 'Omröstning: Källans kompletterande rubrik' })).toBeVisible();
});
