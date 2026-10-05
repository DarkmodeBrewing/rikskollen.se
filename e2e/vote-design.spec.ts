import { test, expect } from './fixtures';
import { events, member } from './data';

test('readable vote/report topics, exact chart counts and source links survive SSR and navigation', async ({
  page,
  request,
  app,
}, testInfo) => {
  await page.goto('/voteringar');
  const topic = page.locator('.document-list a').first();
  await expect(topic.locator('strong')).toHaveText('Registrerad omröstning');
  await expect(topic.locator('small')).toContainText('TEST1 · punkt 1');
  await expect(
    page.locator('.document-list a').nth(1).locator('strong'),
  ).toHaveText('Votering utan importerad rubrik');
  await topic.focus();
  await expect(topic).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('votes.png'),
    fullPage: true,
  });
  await topic.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Registrerad omröstning',
  );
  const chart = page.getByRole('figure', { name: 'Röster i denna votering' });
  await expect(chart).toContainText('2 totalt');
  await expect(chart.locator('strong')).toHaveText(['1', '1']);
  await expect(
    page.getByRole('link', { name: 'Punktrubrikens källa' }),
  ).toHaveAttribute('href', events[0].context!.pointSourceUrl!);
  await page.screenshot({
    path: testInfo.outputPath('vote.png'),
    fullPage: true,
  });
  const html = await (
    await request.get(`${app.url}/votering/${events[0].voteId}`)
  ).text();
  expect(html).toContain('Registrerad omröstning');
  expect(html).toContain('Röster i denna votering');
  for (const [name, path] of [
    ['reports', '/arenden'],
    ['report', '/arende/TESTREPORT'],
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
  }
  await page.goto(`/ledamot/${member.personId}`);
  await expect(page.locator('.history-topic a').first()).toHaveText(
    'Registrerad omröstning',
  );
});

test('vote/report loading, missing and failed requests stay distinct and paging recovers', async ({
  app,
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.member-directory a').first()).toBeVisible();
  let release!: () => void;
  app.delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await page
      .getByRole('navigation', { name: 'Huvudnavigation' })
      .getByRole('link', { name: 'Voteringar' })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Hämtar voteringar' }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByText('Ingen slutförd voteringsimport ännu.'),
    ).toHaveCount(0);
  } finally {
    app.delay = null;
    release();
  }
  await expect(page.getByText('25 voteringar', { exact: true })).toBeVisible();
  app.scenario = 'error';
  await page.goto('/voteringar?page=2');
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Voteringarna kunde inte hämtas' }),
  ).toBeVisible();
  app.scenario = 'normal';
  await page
    .getByRole('navigation', { name: 'Huvudnavigation' })
    .getByRole('link', { name: 'Voteringar' })
    .click();
  await expect(page.getByText('25 voteringar', { exact: true })).toBeVisible();
  for (const [path, loading] of [
    [`/votering/${events[0].voteId}`, 'Voteringen'],
    ['/arende/TESTREPORT', 'Beslutsunderlaget'],
  ]) {
    app.scenario = 'error';
    await page.goto(path);
    await expect(page.getByRole('alert')).toContainText(
      `${loading} kunde inte hämtas`,
    );
    app.scenario = 'missing';
    await page.reload();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByText(/Voteringen saknas|Inget beslutsunderlag har importerats/),
    ).toBeVisible();
  }
});
