import { test, expect } from './fixtures';

test('transparency is server rendered, indexable and available without the data API', async ({
  app,
  request,
}) => {
  app.scenario = 'error';
  const response = await request.get(`${app.url}/om`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<title>Om Rikskollen | Rikskollen</title>');
  expect(html).toContain('href="https://rikskollen.se/om"');
  expect(html).toContain(
    'property="og:url" content="https://rikskollen.se/om"',
  );
  expect(html).toContain('content="index, follow"');
  expect(html).toContain('AI-assisterade kodverktyg');
  expect(html).toContain('Frånvarande betyder registrerad som frånvarande');
  expect(html).toContain('DarkmodeTools');
  expect(html).toContain(
    'Verifierade uppgifter om driftloggarnas lagringstider',
  );
  const sitemap = await (await request.get(`${app.url}/sitemap.xml`)).text();
  expect(sitemap).toContain('<loc>https://rikskollen.se/om</loc>');
  expect(app.requests.filter((path) => path.startsWith('/api/'))).toEqual([]);
});

test('about navigation, privacy anchors and source links work on keyboard and narrow screens', async ({
  page,
  app,
}, testInfo) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  const about = footer.getByRole('link', {
    name: 'Om Rikskollen',
    exact: true,
  });
  await about.focus();
  await expect(about).toBeFocused();
  await about.press('Enter');
  await expect(page).toHaveURL(/\/om$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Om Rikskollen',
  );
  await expect(page).toHaveTitle('Om Rikskollen | Rikskollen');
  await page.evaluate(() => {
    (window as unknown as { aboutMarker: boolean }).aboutMarker = true;
  });
  await page
    .getByRole('navigation', { name: 'På denna sida' })
    .getByRole('link', { name: 'Så räknar vi' })
    .click();
  await expect(page).toHaveURL(/\/om#metod$/);
  await expect(page.locator('#method-title')).toBeInViewport();
  await expect(page.locator('#metod')).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as unknown as { aboutMarker: boolean }).aboutMarker,
    ),
  ).toBe(true);
  await footer
    .getByRole('link', { name: 'Integritet och besöksstatistik' })
    .click();
  await expect(page).toHaveURL(/\/om#integritet$/);
  await expect(page.locator('#privacy-title')).toBeInViewport();
  await page.reload();
  await expect(page.locator('#privacy-title')).toBeInViewport();
  await expect(
    page.getByRole('link', {
      name: 'Rapportera fel eller ställ en fråga via GitHub Issues',
    }),
  ).toHaveAttribute(
    'href',
    'https://github.com/DarkmodeTools/rikskollen.se/issues',
  );
  await expect(
    page.getByRole('link', {
      name: 'den fullständiga metoden med källänkade räkneexempel',
    }),
  ).toHaveAttribute(
    'href',
    'https://github.com/DarkmodeTools/rikskollen.se/blob/main/docs/data-methodology.md',
  );
  const sourceLink = page.getByRole('link', {
    name: 'riksdagens användningsvillkor',
    exact: true,
  });
  await expect(sourceLink).toHaveAttribute(
    'href',
    /riksdagen\.se.*anvandningsvillkor/,
  );
  expect(await page.context().cookies()).toEqual([]);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('article', { name: 'Om tjänsten' })
    .screenshot({ path: `test-results/about-${testInfo.project.name}.png` });
  if (testInfo.project.name.includes('mobile')) {
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page
        .getByRole('navigation', { name: 'Huvudnavigation' })
        .getByRole('link', { name: 'Om Rikskollen' }),
    ).toBeVisible();
  }
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Datastatus', exact: true })
    .click();
  await expect(page).toHaveTitle('Datastatus | Rikskollen');
  await page.goBack();
  await expect(page).toHaveTitle('Om Rikskollen | Rikskollen');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://rikskollen.se/om',
  );
});
