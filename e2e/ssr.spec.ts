import { test, expect } from './fixtures';
import { member, events, trail } from './data';

test('source availability is explicit in SSR without reducing the catalog denominator', async ({
  request,
  app,
}) => {
  const html = await (await request.get(`${app.url}/datastatus`)).text();
  expect(html).toContain('Strukturerade beslutsunderlag saknas i källan');
  expect(html).toContain('Syntetiskt underlag utan strukturerade punkter');
  expect(html).toContain(
    'Saknade punkter betyder inte att ärendet har noll beslut',
  );
  expect(html).toContain('1 betänkande saknar beslutsunderlag');
  expect(html).toContain(
    'https://data.riksdagen.se/dokumentstatus/TESTUNAVAILABLE.json',
  );
});

test('SSR delivers data and controlled failure states without a browser', async ({
  app,
  request,
}) => {
  for (const [path, expected] of [
    [`/ledamot/${member.personId}`, 'Test Ledamot'],
    [`/votering/${events[0].voteId}`, 'Ledamotsröster (2)'],
    ['/arende/TESTREPORT', trail.document.title],
    ['/arenden', 'Av 5 beslutspunkter'],
  ]) {
    const response = await request.get(`${app.url}${path}`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain(expected);
  }
  app.scenario = 'error';
  expect(await (await request.get(`${app.url}/arenden`)).text()).toContain(
    'Beslutsunderlagen kunde inte hämtas.',
  );
  app.scenario = 'empty';
  expect(await (await request.get(`${app.url}/arenden`)).text()).toContain(
    'Inga betänkanden importerade.',
  );
});

test('SSR accepts a configured deployment host and rejects an unlisted host', async ({
  app,
  request,
}) => {
  const permitted = await request.get(`${app.url}/arenden`, {
    headers: { host: 'test.rikskollen.invalid' },
  });
  expect(permitted.status()).toBe(200);
  expect(await permitted.text()).toContain('Av 5 beslutspunkter');
  const denied = await request.get(`${app.url}/arenden`, {
    headers: { host: 'unlisted.invalid' },
  });
  expect(denied.status()).toBe(400);
});
