import { test, expect } from './fixtures';

test('homepage explains scoped figures and links dated reports to source and detail', async ({
  page,
  app,
  request,
}) => {
  const html = await (await request.get(`${app.url}/`)).text();
  expect(html).toContain('Följ besluten.');
  expect(html).toContain('Syntetiskt testärende');
  expect(html).toContain('1 saknar importerade underlag');
  await page.goto('/');
  await expect(page).toHaveTitle('Utforska riksdagens beslut | Rikskollen');
  const methods = page.getByRole('article', {
    name: 'Beslutssätt på förslagspunkter',
  });
  await expect(methods).toContainText('5 importerade punkter');
  await expect(methods).toContainText('Underlag för 1 av 2');
  await expect(methods).toContainText(
    'inget extra antal att dra från täckningen',
  );
  await expect(
    page.getByRole('link', { name: 'Originalets dokumentstatus' }),
  ).toHaveAttribute('href', /data.riksdagen.se/);
  await page
    .getByRole('link', { name: 'Syntetiskt testärende', exact: true })
    .click();
  await expect(page).toHaveURL(/arende\/TESTREPORT$/);
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'Rikskollen.' })
    .click();
  const search = page.getByRole('textbox', {
    name: 'Hitta en ledamot efter namn, parti eller valkrets',
  });
  await search.fill('Test');
  await search.press('Enter');
  await expect(page).toHaveURL(/ledamoter\?q=Test$/);
  await expect(page.getByText('31 personer', { exact: true })).toBeVisible();
  const legacy = await request.get(`${app.url}/?q=Test&page=2`);
  expect(await legacy.text()).toContain('Sida 2 av 2');
  await page.goto('/?q=Test&page=2');
  await expect(page).toHaveURL(/ledamoter\?q=Test&page=2$/);
  await expect(page.getByText('Sida 2 av 2')).toBeVisible();
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('homepage distinguishes missing imports and outage, retains discovery and retries', async ({
  page,
  app,
}) => {
  app.scenario = 'empty';
  await page.goto('/');
  await expect(
    page.getByText(
      'Ingen slutförd voteringsimport för 2025/26 ännu. Antalet är okänt.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Ingen fullständig betänkandekatalog har importerats ännu.',
      { exact: true },
    ),
  ).toBeVisible();
  app.scenario = 'error';
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    'Överblicken kunde inte hämtas',
  );
  await expect(
    page
      .getByRole('navigation', { name: 'Utforska uppgifterna' })
      .getByRole('link'),
  ).toHaveCount(3);
  app.scenario = 'normal';
  const retry = page.getByRole('button', { name: 'Försök igen' });
  await retry.focus();
  await retry.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Vad finns i underlaget?' }),
  ).toBeVisible();
});
