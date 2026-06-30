#!/usr/bin/env node
/**
 * Deterministic SQLite-backed cache for the agentic workflow. Stores fetched
 * context, Jira issues, Figma metadata, plan fragments, etc. so later stages
 * reuse them instead of re-fetching / re-reasoning (saves tokens).
 *
 * Backed by Node's built-in `node:sqlite` (stable in Node >= 22) — no external
 * dependency, works standalone inside any target repo.
 *
 * Store: <cacheDir>/cache.db
 *   table cache(scope, key, value, created_at, ttl, PRIMARY KEY(scope, key))
 *
 * Usage:
 *   node cache.mjs set    --key jira:FX-1 --value "<toon>"   [--scope s] [--ttl 3600]
 *   node cache.mjs set    --key jira:FX-1 --file path.toon   [--scope s] [--ttl 3600]
 *   node cache.mjs get    --key jira:FX-1 [--scope s] [--raw]
 *   node cache.mjs has    --key jira:FX-1 [--scope s]
 *   node cache.mjs del    --key jira:FX-1 [--scope s]
 *   node cache.mjs list   [--scope s]
 *   node cache.mjs prune  [--max-age 86400]      # also drops ttl-expired rows
 *
 * Flags: --cache-dir <dir> (default .agentic/cache) · --ttl <seconds, 0 = never>
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Silence only the "SQLite is an experimental feature" notice (Node < 24).
const __emit = process.emit;
process.emit = function (name, data, ...rest) {
  if (name === 'warning' && data && data.name === 'ExperimentalWarning' && /SQLite/.test(String(data.message))) return false;
  return __emit.call(this, name, data, ...rest);
};

// ---- tiny TOON encoder (self-contained) -------------------------------------
function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (s === '' || /[\s,:{}\[\]"]/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"';
  return s;
}
function emit(obj, depth, out) {
  const pad = '  '.repeat(depth);
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length === 0) { out.push(`${pad}${k}[0]:`); continue; }
      const allScalar = v.every((x) => x === null || typeof x !== 'object');
      if (allScalar) { out.push(`${pad}${k}[${v.length}]: ${v.map(scalar).join(',')}`); continue; }
      const keys = Object.keys(v[0]);
      out.push(`${pad}${k}[${v.length}]{${keys.join(',')}}:`);
      for (const row of v) out.push(`${pad}  ${keys.map((kk) => scalar(row[kk])).join(',')}`);
    } else if (v && typeof v === 'object') {
      out.push(`${pad}${k}:`); emit(v, depth + 1, out);
    } else {
      out.push(`${pad}${k}: ${scalar(v)}`);
    }
  }
}
function toon(obj) { const out = []; emit(obj, 0, out); return out.join('\n'); }
function fail(message) { console.log(toon({ error: { skill: 'cache', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }

const cmd = process.argv[2];
const VALID = ['set', 'get', 'has', 'del', 'list', 'prune'];
if (!VALID.includes(cmd)) fail(`command must be one of ${VALID.join('|')}`);

const cacheDir = getArg('cache-dir') || '.agentic/cache';
const scope = getArg('scope') || 'default';
const key = getArg('key');
const now = Math.floor(Date.now() / 1000);

if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
const db = new DatabaseSync(join(cacheDir, 'cache.db'));
db.exec(`CREATE TABLE IF NOT EXISTS cache (
  scope      TEXT    NOT NULL DEFAULT 'default',
  key        TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  ttl        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key)
)`);

const expired = (row) => row.ttl > 0 && now > row.created_at + row.ttl;

switch (cmd) {
  case 'set': {
    if (!key) fail('--key required');
    let value = getArg('value');
    const file = getArg('file');
    if (value === undefined && file) {
      if (!existsSync(file)) fail(`--file not found: ${file}`);
      value = readFileSync(file, 'utf8');
    }
    if (value === undefined) fail('provide --value or --file');
    const ttlRaw = Number(getArg('ttl') ?? 0);
    if (!Number.isFinite(ttlRaw) || ttlRaw < 0) fail('--ttl must be a non-negative number');
    const ttl = Math.floor(ttlRaw);
    db.prepare(
      `INSERT INTO cache (scope, key, value, created_at, ttl) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, created_at = excluded.created_at, ttl = excluded.ttl`,
    ).run(scope, key, value, now, ttl);
    console.log(toon({ cache: { action: 'set', scope, key, bytes: Buffer.byteLength(value), ttl } }));
    break;
  }
  case 'get': {
    if (!key) fail('--key required');
    const row = db.prepare('SELECT * FROM cache WHERE scope = ? AND key = ?').get(scope, key);
    if (!row || expired(row)) {
      if (row) db.prepare('DELETE FROM cache WHERE scope = ? AND key = ?').run(scope, key);
      if (hasFlag('raw')) process.exit(1);
      console.log(toon({ cache: { action: 'get', scope, key, hit: false } }));
      process.exit(1);
    }
    if (hasFlag('raw')) { process.stdout.write(row.value); break; }
    console.log(
      toon({
        cache: {
          action: 'get', scope, key, hit: true,
          ageSec: now - row.created_at, bytes: Buffer.byteLength(row.value),
        },
        value: row.value,
      }),
    );
    break;
  }
  case 'has': {
    if (!key) fail('--key required');
    const row = db.prepare('SELECT created_at, ttl FROM cache WHERE scope = ? AND key = ?').get(scope, key);
    const hit = !!row && !expired(row);
    console.log(toon({ cache: { action: 'has', scope, key, hit } }));
    process.exit(hit ? 0 : 1);
  }
  case 'del': {
    if (!key) fail('--key required');
    const info = db.prepare('DELETE FROM cache WHERE scope = ? AND key = ?').run(scope, key);
    console.log(toon({ cache: { action: 'del', scope, key, deleted: info.changes } }));
    break;
  }
  case 'list': {
    const rows = db
      .prepare('SELECT key, created_at, ttl, length(CAST(value AS BLOB)) AS bytes FROM cache WHERE scope = ? ORDER BY created_at DESC')
      .all(scope)
      .filter((r) => !expired(r))
      .map((r) => ({ key: r.key, ageSec: now - r.created_at, ttl: r.ttl, bytes: r.bytes }));
    console.log(toon({ cache: { action: 'list', scope, count: rows.length }, entries: rows }));
    break;
  }
  case 'prune': {
    const maxAge = Number(getArg('max-age') ?? 0) || 0;
    const ttlInfo = db.prepare('DELETE FROM cache WHERE ttl > 0 AND ? > created_at + ttl').run(now);
    let ageRemoved = 0;
    if (maxAge > 0) {
      ageRemoved = db.prepare('DELETE FROM cache WHERE ? - created_at > ?').run(now, maxAge).changes;
    }
    console.log(toon({ cache: { action: 'prune', expiredRemoved: ttlInfo.changes, ageRemoved } }));
    break;
  }
}

db.close();
