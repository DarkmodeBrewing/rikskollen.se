// Offline static audit. Never connects to a database or executes upstream code.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile(new URL('./plausible-source-manifest.json', import.meta.url), 'utf8'));
assert(process.argv[2], 'Usage: node prototypes/visitor-analytics/inspect-plausible.mjs EXTRACTED_SOURCE_DIRECTORY');
const sources = {};
for (const [name, expected] of Object.entries(manifest.files)) {
  const bytes = await readFile(resolve(process.argv[2], name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `Pinned source mismatch: ${name}`);
  sources[name] = bytes.toString('utf8');
}
const schema = sources['priv/ingest_repo/structure.sql'];
assert.match(schema, /CREATE TABLE plausible_events_db\.events_v2/);
assert.match(schema, /CREATE TABLE plausible_events_db\.sessions_v2/);
assert.match(schema, /VersionedCollapsingMergeTree\(sign, events\)/);
assert.doesNotMatch(schema, /\bTTL\b/);
for (const path of ['lib/plausible/clickhouse_event_v2.ex', 'lib/plausible/clickhouse_session_v2.ex']) {
  for (const field of ['user_id', 'session_id', 'referrer', 'city_geoname_id', 'operating_system', 'browser']) assert(sources[path].includes(`field :${field},`), `${path}: ${field}`);
}
assert.match(sources['lib/plausible/purge.ex'], /native_stats_start_at: NaiveDateTime\.utc_now/);
assert.match(sources['lib/plausible/session/salts.ex'], /hour: -48/);
assert.match(sources['lib/plausible/session/cache_store.ex'], /find_session\(event, event\.user_id\) \|\| find_session\(event, prev_user_id\)/);
assert.match(sources['config/runtime.exs'], /"0 0 \* \* \*", Plausible.Workers.RotateSalts/);
console.log(JSON.stringify({
  revision: manifest.revision, verifiedFiles: Object.keys(sources).length,
  status: 'PASS: pinned static assertions only',
  nativeTables: ['events_v2', 'sessions_v2'], schemaSnapshotHasTTL: false,
  storedDimensions: ['user/session identifiers', 'referrer/campaign', 'geography', 'browser/device'],
  nativeReset: 'visibility cutoff; not evidence of physical deletion',
  identity: 'daily scheduled rotation; previous-salt matching; cleanup uses a 48-hour threshold',
  retentionEnforced: false, runtimeTested: false,
}, null, 2));
