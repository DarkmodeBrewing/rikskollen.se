import { z } from 'zod';

export async function fetchJson<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
): Promise<z.infer<S>> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 60_000); // the member roster can be a large response

  try {
    const res = await fetch(url, { signal: ac.signal });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const raw = await res.text();
    const json = raw === '' ? null : JSON.parse(raw);
    const parsed = schema.parse(json);

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

// Retry only transient transport failures. Schema and count errors are not retried.
export async function fetchJsonWithRetry<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
): Promise<z.infer<S>> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchJson(url, schema);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        /HTTP (429|5\d\d)\b/.test(message) ||
        (error instanceof Error &&
          ['AbortError', 'TypeError'].includes(error.name));
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error('Unreachable retry state');
}
