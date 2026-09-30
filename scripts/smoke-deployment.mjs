import assert from 'node:assert/strict';

const base = process.env.STAGING_BASE_URL || 'http://127.0.0.1:4080';
const empty = process.argv.includes('--empty');
async function request(path, status = 200, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options, signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, status, `${path}: expected HTTP ${status}`);
  return response;
}
assert.equal((await (await request('/health')).json()).ok, true);
for (const path of ['/api/persons', '/api/votes', '/api/decisions']) {
  const data = await (await request(`${path}?limit=1`)).json();
  assert.ok(Array.isArray(data.items), `${path}: items missing`);
  assert.ok(Number.isInteger(data.total) && data.total >= 0, `${path}: total invalid`);
  if (empty) assert.equal(data.total, 0, `${path}: expected fresh database`);
}
if (empty) {
  for (const path of ['/api/import-status', '/api/votes/import-status'])
    assert.equal(await (await request(path)).json(), null);
  const decisions = await (await request('/api/decisions')).json();
  assert.equal(decisions.catalogCoverage, null);
  assert.equal(decisions.decisionMethodSummary, null);
  const history = await (await request('/api/persons/0000000000001/votes')).json();
  assert.equal(history.summary, null);
}
await request('/api/persons?page=0', 400);
await request('/api/votes', 405, { method: 'POST' });
const pages = [
  ['/', 'Utforska riksdagens ledamöter'],
  ['/voteringar', 'Registrerade voteringar'],
  ['/arenden', 'Ärenden och beslutspunkter'],
];
let asset;
for (const [path, heading] of pages) {
  const response = await request(path);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  const html = await response.text();
  assert.ok(html.includes(heading), `${path}: server-rendered heading missing`);
  assert.ok(html.includes('Källa: Sveriges riksdag'), `${path}: attribution missing`);
  asset ||= html.match(/src="(main-[^"]+\.js)"/)?.[1];
}
assert.ok(asset, 'Browser bundle link missing');
await request(`/${asset}`);
console.log(`Deployment smoke passed (${empty ? 'fresh database' : 'current data'}): ${base}`);
