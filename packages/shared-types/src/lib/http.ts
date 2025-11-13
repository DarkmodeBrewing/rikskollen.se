import { z } from 'zod';
import { request } from 'undici';

export async function fetchJson<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
): Promise<z.infer<S>> {
  try {
    const res = await request(url);
    const { statusCode, body } = res;

    if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`);

    const json = await body.json();

    return schema.parse(json);
  } catch (e) {
    console.error(e);
    return schema.parse(null);
  }
}
