import { z } from 'zod';

export async function fetchJson<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
): Promise<z.infer<S>> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 10_000); // 10s timeout

  try {
    const res = await fetch(url, { signal: ac.signal });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const raw = await res.text();
    const json = raw === '' ? null : JSON.parse(raw);
    const parsed = schema.parse(json);

    return parsed;
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
