export const pick = <T extends object, K extends readonly (keyof any)[]>(
  obj: any,
  keys: K,
) => Object.fromEntries(keys.map((k) => [k, obj[k as any]]));
