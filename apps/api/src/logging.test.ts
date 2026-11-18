import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privateLogSerializers } from './logging';
test('diagnostics omit request identifiers, search terms, headers and error payloads', () => {
  const request = { method: 'GET', url: '/api/persons?q=private', remoteAddress: '192.0.2.1', headers: { authorization: 'secret' } };
  assert.deepEqual(privateLogSerializers.req(request), { method: 'GET' });
  assert.deepEqual(privateLogSerializers.err(new Error('private query or SQL parameters')), { type: 'Error', message: 'Details omitted', stack: '' });
});

test('Pino does not copy an error message into the top-level log message', async () => {
  const { pino } = await import('pino');
  const { privateLogHooks } = await import('./logging');
  const lines: string[] = [];
  const log = pino({ serializers: privateLogSerializers, hooks: privateLogHooks }, { write: (line: string) => { lines.push(line); } });
  log.error(new Error('private query'));
  log.error({ err: new Error('secret headers'), req: { method: 'GET', url: 'private search' } }, 'sensitive database payload');
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.doesNotMatch(line, /private query|secret headers|private search|sensitive database payload/);
    assert.equal(JSON.parse(line).msg, 'Application error');
  }
});
