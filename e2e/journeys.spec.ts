import { test, expect } from './fixtures';
import { member, events, trail } from './data';

test('member search, paging and keyboard navigation preserve the query', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByRole('textbox', {
    name: 'Sök namn, parti eller valkrets',
  });
  await search.focus();
  await expect(search).toBeFocused();
  await search.fill('Test');
  await search.press('Enter');
  await expect(page).toHaveURL(/q=Test/);
  await expect(page.getByText('31 personer', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Nästa' }).click();
  await expect(page).toHaveURL(/q=Test.*page=2/);
  await expect(search).toHaveValue('Test');
  await expect(page.getByText('Sida 2 av 2')).toBeVisible();
  await page.getByRole('link', { name: 'Föregående' }).click();
  await page
    .getByRole('link')
    .filter({ has: page.getByText('Test Ledamot', { exact: true }) })
    .click();
  await expect(page).toHaveURL(`/ledamot/${member.personId}`);
  await expect(
    page.getByRole('heading', { name: 'Test Ledamot', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Visa originalpost' }),
  ).toHaveAttribute('href', member.personUrl!);
});

test('history counts retain their denominator through filter, paging and browser history', async ({
  page,
  app,
}) => {
  await page.goto(`/ledamot/${member.personId}`);
  const summary = page.getByRole('region', {
    name: 'Källans noteringar för personen',
  });
  await expect(summary).toContainText('25 källposter');
  await expect(summary).toContainText('27 importerade voteringshändelser');
  await expect(summary).toContainText('2 voteringshändelser saknar källpost');
  for (const value of ['Frånvarande: 21', 'Ja: 3', 'Oväntat: 1'])
    await expect(
      summary.getByRole('link', { name: value, exact: true }),
    ).toBeVisible();
  await summary
    .getByRole('link', { name: 'Frånvarande: 21', exact: true })
    .click();
  await expect(page).toHaveURL(/voteChoice=Fr%C3%A5nvarande/);
  await expect(
    summary.getByRole('link', { name: 'Frånvarande: 21' }),
  ).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('21 källposter visas med filtret')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Rösthistorik' })
    .getByRole('link', { name: 'Nästa' })
    .click();
  await expect(page).toHaveURL(/votesPage=2/);
  await expect(summary).toContainText('25 källposter');
  await expect(
    page.getByRole('link', { name: 'TEST1 · punkt 21', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/votesPage=1/);
  await page.goForward();
  await expect(page).toHaveURL(/votesPage=2/);
  await page.reload();
  await expect(summary).toContainText('25 källposter');
  expect(
    app.requests.some(
      (url) => url.includes('page=2') && url.includes('choice='),
    ),
  ).toBe(true);
});

test('vote to report links match fixtures, acclamation and unavailable context retain sources', async ({
  page,
}) => {
  await page.goto('/voteringar');
  await page
    .getByRole('link')
    .filter({ has: page.getByText('TEST1 · punkt 1', { exact: true }) })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ledamotsröster (2)' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Historisk Testperson' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Voteringens källa' }),
  ).toHaveAttribute('href', events[0].sourceUrl);
  await page.getByRole('link', { name: 'Ärende och beslutspunkter' }).click();
  await expect(
    page.getByRole('heading', { name: trail.document.title }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Visa registrerad votering' }),
  ).toHaveAttribute('href', `/votering/${events[0].voteId}`);
  const acclamation = page
    .getByRole('heading', { name: 'Punkt 2 · Acklamation', exact: true })
    .locator('..');
  await expect(acclamation).toContainText('ingen registrerad votering');
  await expect(acclamation.getByRole('link')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Votering hos Riksdagen' }),
  ).toHaveAttribute(
    'href',
    'https://data.riksdagen.se/votering/unavailable-vote',
  );
  await expect(
    page.getByRole('link', { name: 'Dokumentstatus, källa' }),
  ).toHaveAttribute('href', trail.sourceUrl);
});

test('catalog summary exposes coverage, denominator, other and unknown methods', async ({
  page,
}) => {
  await page.goto('/arenden');
  await expect(
    page.getByText(/Beslutsunderlag finns för 1 av 3 betänkanden markerade/),
  ).toBeVisible();
  const summary = page.getByRole('region', {
    name: 'Beslutssätt i importerade betänkanden',
  });
  await expect(summary).toContainText('Av 5 beslutspunkter');
  for (const value of [
    'Röstning: 2',
    'Acklamation: 1',
    'Annan beslutstyp: 1',
    'Beslutstyp saknas: 1',
    'annat (1)',
    '2 katalogbetänkanden saknar',
  ])
    await expect(summary).toContainText(value);
  await page.getByRole('link', { name: /2025\/26:TEST1/ }).click();
  await expect(page.getByText('5 förslagspunkter')).toBeVisible();
});

test('direct deep links include fixture data before JavaScript and hydrate for client navigation', async ({
  request,
  page,
  app,
}) => {
  for (const [path, text] of [
    [`/ledamot/${member.personId}`, 'Test Ledamot'],
    [`/votering/${events[0].voteId}`, 'Ledamotsröster (2)'],
    ['/arende/TESTREPORT', trail.document.title],
    ['/arenden', 'Av 5 beslutspunkter'],
  ]) {
    const response = await request.get(`${app.url}${path}`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(text);
  }
  await page.goto('/arende/TESTREPORT');
  await expect
    .poll(() =>
      page.evaluate(
        () => !!document.querySelector('app-root')?.getAttribute('ng-version'),
      ),
    )
    .toBe(true);
  // An in-memory marker survives RouterLink navigation, proving this isn't a document reload.
  await page.evaluate(() => {
    (window as unknown as { testMarker: boolean }).testMarker = true;
  });
  await page.getByRole('link', { name: 'Visa registrerad votering' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ledamotsröster (2)' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { testMarker: boolean }).testMarker,
    ),
  ).toBe(true);
});

test('empty lists and unavailable imports are visible', async ({
  app,
  page,
}) => {
  app.scenario = 'empty';
  await page.goto('/');
  await expect(
    page.getByText('Inga träffar. Prova en annan sökning.'),
  ).toBeVisible();
  await expect(
    page.getByText('Ingen slutförd import ännu. Listan kan vara tom.'),
  ).toBeVisible();
  await page.goto('/voteringar');
  await expect(page.getByText('Inga voteringar importerade.')).toBeVisible();
  await expect(
    page.getByText('Ingen slutförd voteringsimport ännu.'),
  ).toBeVisible();
  await page.goto('/arenden');
  await expect(page.getByText('Inga betänkanden importerade.')).toBeVisible();
  await page.goto(`/ledamot/${member.personId}`);
  await expect(
    page.getByText('Ingen slutförd voteringsimport för 2025/26 finns ännu.'),
  ).toBeVisible();
});

test('missing details use current unavailable-state copy', async ({
  app,
  page,
}) => {
  app.scenario = 'missing';
  await page.goto(`/ledamot/${member.personId}`);
  await expect(
    page.getByText('Profilen kunde inte hämtas eller saknas.'),
  ).toBeVisible();
  await page.goto(`/votering/${events[0].voteId}`);
  await expect(
    page.getByText('Voteringen kunde inte hämtas eller saknas.'),
  ).toBeVisible();
  await page.goto('/arende/TESTREPORT');
  await expect(
    page.getByText(
      'Inget beslutsunderlag har importerats för detta ärende ännu.',
    ),
  ).toBeVisible();
});

test('API outage differs from empty data and refresh recovers', async ({
  app,
  page,
}) => {
  app.scenario = 'error';
  await page.goto('/');
  await expect(
    page.getByText(
      'Listan kunde inte hämtas. Kontrollera att API och databas körs.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Inga träffar. Prova en annan sökning.'),
  ).toHaveCount(0);
  await page.goto('/arenden');
  await expect(
    page.getByText('Beslutsunderlagen kunde inte hämtas.'),
  ).toBeVisible();
  app.scenario = 'normal';
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Beslutssätt i importerade betänkanden',
    }),
  ).toBeVisible();
});

test('delayed browser API request completes without losing navigation', async ({
  app,
  page,
}) => {
  await page.goto('/');
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
      page.getByRole('heading', { name: 'Registrerade voteringar' }),
    ).toBeVisible();
    await expect
      .poll(() => app.requests.some((url) => url.startsWith('/api/votes?')))
      .toBe(true);
  } finally {
    app.delay = null;
    release();
  }
  await expect(page.getByText('25 voteringar', { exact: true })).toBeVisible();
});

test('unavailable local report keeps original document and vote links', async ({
  app,
  page,
}) => {
  app.scenario = 'no-context';
  await page.goto(`/votering/${events[0].voteId}`);
  await expect(
    page.getByRole('link', { name: 'Ärende och beslutspunkter' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Betänkande/dokument' }),
  ).toHaveAttribute('href', 'https://data.riksdagen.se/dokument/TESTREPORT');
});
