import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserRequest, validateCollector } from './collection.mjs';
const origin = 'https://rikskollen.se';

test('sensitive entity paths, queries, fragments and referrers never enter the request envelope', () => {
  for (const [path, category] of [['/ledamot/secret-person', 'member-detail'], ['/votering/secret-vote','vote-detail'], ['/arende/secret-report','report-detail'], ['/om','about']]) {
    const request = browserRequest(path + '?q=private-search&utm_term=private-campaign#private-fragment', { referrer: 'https://private-referrer.example/secret-path?q=private-query' });
    assert.deepEqual(JSON.parse(request.init.body), { category, source: 'external' });
    assert.equal(request.url, origin + '/api/usage');
    assert.equal(request.init.credentials, 'omit');
    assert.equal(request.init.referrerPolicy, 'no-referrer');
    assert.doesNotMatch(JSON.stringify(request), /secret|private|utm|person|report\?/);
    assert.deepEqual(validateCollector(request.init.body, origin), { category, source: 'external' });
  }
});
test('all proposed page categories are supported without retaining query values', () => {
  for (const path of ['/', '/ledamoter', '/voteringar', '/arenden', '/datastatus', '/om']) {
    const request = browserRequest(path + '?q=secret');
    assert(request); assert(validateCollector(request.init.body, origin));
    assert.equal(JSON.parse(request.init.body).source, 'direct-or-unknown');
  }
});
test('privacy signals and unknown/non-site routes produce no request', () => {
  for (const options of [{ doNotTrack: true }, { doNotTrack: '1' }, { globalPrivacyControl: true }]) assert.equal(browserRequest('/', options), null);
  for (const path of ['/api/persons', '/analytics', '/unknown/secret', '/ledamot/', '/ledamot/a/b', 'https://other.example/', '//other.example/', 'https://user:secret@rikskollen.se/']) assert.equal(browserRequest(path), null);
});
test('collector rejects extra fields, arbitrary categories, malformed and oversized payloads and wrong origins', () => {
  const good = { category: 'home', source: 'direct-or-unknown' };
  for (const extra of [{ title:'secret' }, { url:'/ledamot/secret' }, { query:'secret' }, { referrer:'secret' }, { userId:'secret' }]) assert.equal(validateCollector(JSON.stringify({ ...good, ...extra }), origin), null);
  for (const body of ['null', '[]', '{}', 'broken', ' '.repeat(513), JSON.stringify({ category:'secret',source:'external' }), JSON.stringify({ category:'home',source:'private.example' })]) assert.equal(validateCollector(body, origin), null);
  for (const other of [null, '', 'https://other.example', origin+'.evil']) assert.equal(validateCollector(JSON.stringify(good), other), null);
});
test('synthetic worked example preserves counts while hiding political entities', () => {
  const categories = ['/ledamot/secret-a', '/ledamot/secret-b', '/om?q=secret#secret'].map(path => JSON.parse(browserRequest(path).init.body).category);
  assert.deepEqual(categories, ['member-detail', 'member-detail', 'about']);
});
