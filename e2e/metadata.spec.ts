import { test, expect } from './fixtures';
import { member, events } from './data';

test('SSR serves descriptive titles, canonical URLs and social cards before JavaScript', async ({
  app,
  request,
}) => {
  for (const [path, title] of [
    ['/', 'Ledamöter | Rikskollen'],
    ['/voteringar', 'Registrerade voteringar | Rikskollen'],
    ['/arenden', 'Ärenden och beslutspunkter | Rikskollen'],
    [
      `/ledamot/${member.personId}`,
      'Test Ledamot – ledamotsprofil | Rikskollen',
    ],
    [
      `/votering/${events[0].voteId}`,
      'Registrerad omröstning – Syntetiskt testärende – votering | Rikskollen',
    ],
    ['/arende/TESTREPORT', 'Syntetiskt testärende – ärende | Rikskollen'],
  ]) {
    const html = await (await request.get(`${app.url}${path}`)).text();
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain('lang="sv"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('https://rikskollen.se/social-preview.png');
    expect(html).toContain(`href="https://rikskollen.se${path}"`);
    expect(html).toContain('content="index, follow"');
    expect(html).not.toContain('<title>Webapp</title>');
  }
  expect(
    (await request.get(`${app.url}/social-preview.png`)).headers()[
      'content-type'
    ],
  ).toContain('image/png');
  expect((await request.get(`${app.url}/favicon.svg`)).status()).toBe(200);
  expect((await request.get(`${app.url}/favicon.ico`)).status()).toBe(200);
  expect(await (await request.get(`${app.url}/sitemap.xml`)).text()).toContain(
    'https://rikskollen.se/voteringar',
  );
});

test('client navigation replaces metadata, shares filters and does not index unavailable profiles', async ({
  page,
  app,
}) => {
  await page.goto(`/ledamot/${member.personId}?voteChoice=Ja&votesPage=1`);
  await expect(page).toHaveTitle('Test Ledamot – ledamotsprofil | Rikskollen');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://rikskollen.se/ledamot/${member.personId}`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `https://rikskollen.se/ledamot/${member.personId}?voteChoice=Ja&votesPage=1`,
  );
  await page
    .getByRole('navigation', { name: 'Huvudnavigation' })
    .getByRole('link', { name: 'Voteringar' })
    .click();
  await expect(page).toHaveTitle('Registrerade voteringar | Rikskollen');
  await page.locator(`a[href="/votering/${events[0].voteId}"]`).click();
  await expect(page).toHaveTitle(
    'Registrerad omröstning – Syntetiskt testärende – votering | Rikskollen',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Registrerad omröstning – Syntetiskt testärende – votering | Rikskollen',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await page.goto('/voteringar?page=2');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://rikskollen.se/voteringar?page=2',
  );
  await page.goto('/?q=Test&page=2');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://rikskollen.se/',
  );
  app.scenario = 'missing';
  await page.goto(`/ledamot/${member.personId}`);
  await expect(page).toHaveTitle('Ledamotsprofil saknas | Rikskollen');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  app.scenario = 'error';
  await page.goto('/arende/TESTREPORT');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Ärende | Rikskollen',
  );
});
