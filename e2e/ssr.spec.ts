import { test, expect } from './fixtures';
import { member, events, trail } from './data';

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
