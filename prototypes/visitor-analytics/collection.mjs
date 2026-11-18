// Offline prototype only: no application imports, network calls or persistence.
const origin = 'https://rikskollen.se';
const categories = new Map([
  ['/', 'home'], ['/ledamoter', 'members'], ['/voteringar', 'votes'],
  ['/arenden', 'reports'], ['/datastatus', 'data-status'], ['/om', 'about'],
]);
const details = [['/ledamot/', 'member-detail'], ['/votering/', 'vote-detail'], ['/arende/', 'report-detail']];
const allowedCategories = new Set([...categories.values(), ...details.map(([, value]) => value)]);
const allowedSources = new Set(['direct-or-unknown', 'external']);

export function browserRequest(location, { referrer = '', doNotTrack = false, globalPrivacyControl = false } = {}) {
  if (doNotTrack === true || doNotTrack === '1' || globalPrivacyControl === true) return null;
  let url;
  try { url = new URL(location, origin); } catch { return null; }
  if (url.origin !== origin || url.username || url.password) return null;
  const category = categories.get(url.pathname) ?? details.find(([prefix]) =>
    url.pathname.startsWith(prefix) && /^[^/]+$/.test(url.pathname.slice(prefix.length)))?.[1];
  if (!category) return null;
  let source = 'direct-or-unknown';
  try {
    const previous = new URL(referrer);
    if (['http:', 'https:'].includes(previous.protocol) && previous.origin !== origin) source = 'external';
  } catch { /* Unknown referrer is not evidence of an external referral. */ }
  return {
    url: origin + '/api/usage',
    init: {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category, source }),
    },
  };
}

export function validateCollector(body, requestOrigin) {
  if (requestOrigin !== origin || typeof body !== 'string' || Buffer.byteLength(body) > 512) return null;
  let value;
  try { value = JSON.parse(body); } catch { return null; }
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).length !== 2 || !Object.hasOwn(value, 'category') || !Object.hasOwn(value, 'source') ||
      !allowedCategories.has(value.category) || !allowedSources.has(value.source)) return null;
  // Reconstruct from allowed fields; never forward arbitrary client JSON.
  return { category: value.category, source: value.source };
}
