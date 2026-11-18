import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateLogSerializers } from './logging';
test('diagnostics omit request identifiers, search terms, headers and error payloads', () => {
  const request = { method: 'GET', url: '/api/persons?q=private', remoteAddress: '192.0.2.1', headers: { authorization: 'secret' } };
  assert.deepEqual(privateLogSerializers.req(request), { method: 'GET' });
  assert.deepEqual(privateLogSerializers.err(new Error('private query or SQL parameters')), { type: 'Error', message: 'Details omitted', stack: '' });
});
