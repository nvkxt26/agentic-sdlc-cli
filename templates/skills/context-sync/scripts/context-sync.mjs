#!/usr/bin/env node
/**
 * Deterministic codebase-context sync helper. Emits TOON on stdout (caveman FULL).
 *
 * Two modes:
 *   plan  (default) — detect default branch, compare its HEAD against the last
 *                     indexed commit (from <contextDir>/context-meta.json) and
 *                     emit the changed files. First run (no marker) emits the
 *                     full tracked-file list so context can be built from scratch.
 *   --mark          — record the default branch HEAD as the new indexed commit
 *                     (call this AFTER the context docs have been updated).
 *
 * Usage:
 *   node context-sync.mjs [--context-dir .agentic/context] [--branch main]
 *   node context-sync.mjs --mark [--context-dir .agentic/context] [--branch main]
 *
 * Pure git + fs, zero dependencies.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
function fail(message) { console.log(toon({ error: { skill: 'context-sync', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

// ---- inputs -----------------------------------------------------------------
const contextDir = getArg('context-dir') || '.agentic/context';
const metaPath = join(contextDir, 'context-meta.json');

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  fail('not inside a git repository');
}

// ---- default branch detection ----------------------------------------------
function detectDefaultBranch() {
  const override = getArg('branch');
  if (override) return override;
  // Prefer the remote's advertised default.
  try {
    const ref = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
    const name = ref.replace(/^refs\/remotes\/origin\//, '');
    if (name) return name;
  } catch { /* no origin/HEAD; fall through */ }
  for (const cand of ['main', 'develop', 'master']) {
    try { git(['rev-parse', '--verify', '--quiet', cand]); return cand; } catch { /* next */ }
  }
  // Last resort: current branch.
  try { return git(['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return 'HEAD'; }
}

const branch = detectDefaultBranch();

let headCommit;
try {
  headCommit = git(['rev-parse', branch]);
} catch {
  fail(`cannot resolve branch "${branch}"`);
}

// ---- --mark mode ------------------------------------------------------------
if (hasFlag('mark')) {
  if (!existsSync(contextDir)) mkdirSync(contextDir, { recursive: true });
  const meta = {
    version: 1,
    branch,
    lastCommit: headCommit,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(toon({ contextSync: { marked: true, branch, lastCommit: headCommit, metaPath } }));
  process.exit(0);
}

// ---- plan mode --------------------------------------------------------------
let lastCommit = null;
if (existsSync(metaPath)) {
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    lastCommit = typeof meta.lastCommit === 'string' ? meta.lastCommit : null;
  } catch { /* corrupt marker → treat as first run */ }
}

let mode;
let changes;

function parseNameStatus(raw) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0][0]; // A|M|D|R|C...
      const file = parts[parts.length - 1];
      return { status, file };
    });
}

if (!lastCommit) {
  mode = 'full';
  const files = git(['ls-files']).split('\n').map((f) => f.trim()).filter(Boolean);
  changes = files.map((file) => ({ status: 'F', file }));
} else if (lastCommit === headCommit) {
  mode = 'noop';
  changes = [];
} else {
  mode = 'incremental';
  let raw = '';
  try {
    raw = git(['diff', '--name-status', `${lastCommit}..${headCommit}`]);
  } catch {
    // lastCommit unknown to this clone (e.g. force-push/shallow) → rebuild.
    mode = 'full';
    const files = git(['ls-files']).split('\n').map((f) => f.trim()).filter(Boolean);
    changes = files.map((file) => ({ status: 'F', file }));
  }
  if (mode === 'incremental') changes = parseNameStatus(raw);
}

console.log(
  toon({
    contextSync: {
      branch,
      mode,
      lastCommit: lastCommit ?? 'null',
      headCommit,
      contextDir,
      changeCount: changes.length,
    },
    changes,
  }),
);
