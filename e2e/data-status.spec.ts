import { test, expect } from './fixtures';

test('datastatus is linked, rendered by SSR, and shows scoped coverage and attempts', async ({
  page,
  app,
  request,
}, testInfo) => {
  const response = await request.get(`${app.url}/datastatus`);
  const html = await response.text();
  expect(html).toContain('<title>Datastatus | Rikskollen</title>');
  expect(html).toContain('1 betänkande saknar beslutsunderlag');
  expect(html).toContain('Ingen slutstatus har registrerats');
  expect(html).toContain(
    'property="og:title" content="Datastatus | Rikskollen"',
  );
  await page.goto('/');
  await page.getByRole('link', { name: 'Datastatus', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Datastatus', exact: true }),
  ).toBeVisible();
  const reports = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Beslutsunderlag', exact: true }),
  });
  await expect(reports.getByRole('progressbar')).toHaveAttribute('value', '1');
  await expect(reports.getByRole('progressbar')).toHaveAttribute('max', '2');
  await expect(reports).toContainText('Äldsta importerade underlag');
  await expect(reports).toContainText('Senast importerade underlag');
  await expect(page.getByText('Importerna startas manuellt.')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('region', { name: 'Importerade uppgifter' }).screenshot({
    path: `test-results/datastatus-${testInfo.project.name}.png`,
  });
});

test('history paging survives reload and empty imports remain explicit', async ({
  page,
  app,
}) => {
  await page.goto('/datastatus');
  const history = page.getByRole('region', {
    name: 'Importhistorik',
    exact: true,
  });
  await expect(history.getByRole('listitem')).toHaveCount(20);
  await history.getByRole('link', { name: 'Nästa →' }).click();
  await expect(page).toHaveURL(/datastatus\?page=2$/);
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await page.goBack();
  await expect(history.getByRole('listitem')).toHaveCount(20);
  app.scenario = 'empty';
  await page.getByRole('button', { name: 'Uppdatera datastatus' }).click();
  await expect(
    page.getByText('Ingen slutförd import ännu.', { exact: true }),
  ).toHaveCount(3);
  await expect(
    page.getByText('Inga importförsök har registrerats ännu.'),
  ).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('status outage recovers with retry and delayed refresh shows loading', async ({
  page,
  app,
}) => {
  app.scenario = 'error';
  await page.goto('/datastatus');
  await expect(page.getByRole('alert')).toHaveText(
    'Datastatus kunde inte hämtas.',
  );
  app.scenario = 'normal';
  const retry = page.getByRole('button', { name: 'Försök igen' });
  await retry.focus();
  await expect(retry).toBeFocused();
  await retry.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Importerade uppgifter' }),
  ).toBeVisible();
  let release!: () => void;
  app.delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.getByRole('button', { name: 'Uppdatera datastatus' }).click();
  await expect(page.getByRole('status')).toHaveText('Hämtar datastatus…');
  release();
  app.delay = null;
  await expect(
    page.getByRole('heading', { name: 'Importerade uppgifter' }),
  ).toBeVisible();
});
