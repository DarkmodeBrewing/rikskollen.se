/** Allowlist diagnostics: never serialize visitor URLs, headers, IPs or error payloads. */
export const privateLogSerializers = {
  req: (request: { method?: string }) => ({ method: request.method }),
  err: (_error: unknown) => ({ type: 'Error', message: 'Details omitted', stack: '' }),
};
