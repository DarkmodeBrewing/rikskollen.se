/** Allowlist diagnostics: never serialize visitor URLs, headers, IPs or error payloads. */
export const privateLogSerializers = {
  req: (request: { method?: string }) => ({ method: request.method }),
  err: (_error: unknown) => ({ type: 'Error', message: 'Details omitted', stack: '' }),
};

import type { LoggerOptions } from 'pino';
// Pino/Fastify may copy Error.message into `msg` before serializers run.
export const privateLogHooks: LoggerOptions['hooks'] = {
  logMethod(args, method) {
    const payload = args[0];
    if (payload instanceof Error || (payload && typeof payload === 'object' && 'err' in payload)) {
      method.call(this, { err: payload instanceof Error ? payload : payload.err }, 'Application error');
    } else {
      method.apply(this, args);
    }
  },
};
