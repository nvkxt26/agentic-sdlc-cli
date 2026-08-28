#!/usr/bin/env node
/**
 * Deterministic cross-repo context channel. Emits TOON on stdout (caveman FULL).
 *
 * A "workspace" is a folder containing several repos, marked by
 * `.agentic-workspace.json`. Each repo publishes its generated context to a
 * shared registry (default `<workspace>/.agentic/registry/<repo>/`) so peer
 * repos' agents can consult it, and can exchange questions/answers through a
 * simple file mailbox.
 *
 * Actions:
 *   publish [--repo <name>]                 copy this repo's context → registry
 *   list                                    list all published repos (manifests)
 *   read --repo <name> [--file <f.toon>]    print a peer's published context
 *   ask --repo <name> --question "<q>"      post a question to a peer's inbox
 *   inbox                                   list unanswered questions for THIS repo
 *   answer --id <id> (--file <f>|--text <s>) write an answer for a question id
 *   answers --id <id>                       read the answer for a question id
 *   query --repo <name> --match <term>      scoped sub-context: only matching rows/lines
 *         [--file <f.toon>]                 (default: all published .toon files), not the whole file
 *
 * Pure git + fs, zero dependencies.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { basename, dirname, join, parse } from 'node:path';

// ---- tiny TOON encoder (self-contained) -------------------------------------
function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v).replace(/\r?\n/g, ' ').trim();
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
      const uniform = v.every((o) => o && typeof o === 'object' && Object.keys(o).join() === keys.join()
        && keys.every((kk) => o[kk] === null || typeof o[kk] !== 'object'));
      if (uniform) {
        out.push(`${pad}${k}[${v.length}]{${keys.join(',')}}:`);
        for (const row of v) out.push(`${pad}  ${keys.map((kk) => scalar(row[kk])).join(',')}`);
      } else {
        out.push(`${pad}${k}[${v.length}]:`);
        v.forEach((el) => { out.push(`${pad}  -`); emit(el, depth + 2, out); });
      }
    } else if (v && typeof v === 'object') {
      out.push(`${pad}${k}:`); emit(v, depth + 1, out);
    } else {
      out.push(`${pad}${k}: ${scalar(v)}`);
    }
  }
}
function toon(obj) { const out = []; emit(obj, 0, out); return out.join('\n'); }
function fail(message) { console.log(toon({ error: { skill: 'repo-bridge', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

// ---- locate repo + workspace ------------------------------------------------
function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}
function findWorkspaceRoot(start) {
  let dir = start;
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, '.agentic-workspace.json'))) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}
function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

const REPO = repoRoot();
const REPO_NAME = getArg('repo-name') || basename(REPO);
const WS_ROOT = getArg('workspace') || findWorkspaceRoot(REPO);
if (!WS_ROOT) {
  fail('no .agentic-workspace.json found in any parent dir. Run `agentic-sdlc workspace init` at the group root.');
}
const wsCfg = readJson(join(WS_ROOT, '.agentic-workspace.json'), {});
const REGISTRY = join(WS_ROOT, wsCfg.registryDir || '.agentic/registry');

const repoCfg = readJson(join(REPO, '.agentic-sdlc.json'), {});
const CONTEXT_DIR = join(REPO, repoCfg.contextDir || '.agentic/context');

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

// ---- actions ----------------------------------------------------------------
const action = process.argv[2];

function doPublish() {
  const name = getArg('repo') || REPO_NAME;
  const destContext = join(REGISTRY, name, 'context');
  ensureDir(destContext);
  let files = [];
  if (existsSync(CONTEXT_DIR)) {
    files = readdirSync(CONTEXT_DIR).filter((f) => f.endsWith('.toon') || f === 'context-meta.json');
    for (const f of files) copyFileSync(join(CONTEXT_DIR, f), join(destContext, f));
  }
  const meta = readJson(join(CONTEXT_DIR, 'context-meta.json'), {});
  const manifest = {
    name,
    path: REPO,
    lastCommit: meta.lastCommit || '',
    contextFiles: files,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(join(REGISTRY, name, 'repo.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(toon({ repoBridge: { action: 'publish', repo: name, registry: REGISTRY, filesPublished: files.length } }));
}

function listRepos() {
  ensureDir(REGISTRY);
  const repos = readdirSync(REGISTRY, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const m = readJson(join(REGISTRY, d.name, 'repo.json'), {});
      return {
        name: d.name,
        lastCommit: m.lastCommit || '',
        files: Array.isArray(m.contextFiles) ? m.contextFiles.length : 0,
        updatedAt: m.updatedAt || '',
      };
    });
  console.log(toon({ repoBridge: { action: 'list', registry: REGISTRY, count: repos.length }, repos }));
}

function readRepo() {
  const name = getArg('repo');
  if (!name) fail('missing --repo <name>');
  const dir = join(REGISTRY, name, 'context');
  if (!existsSync(dir)) fail(`repo "${name}" has no published context. Ask it to run: repo-bridge -- publish`);
  const file = getArg('file');
  if (file) {
    const p = join(dir, file);
    if (!existsSync(p)) fail(`file "${file}" not found for repo "${name}"`);
    console.log(readFileSync(p, 'utf8'));
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.toon'));
  const sections = files.map((f) => ({ file: f, body: readFileSync(join(dir, f), 'utf8') }));
  const out = [toon({ repoBridge: { action: 'read', repo: name, files: files.length } })];
  for (const s of sections) out.push(`\n# ${s.file}\n${s.body}`);
  console.log(out.join('\n'));
}

function ask() {
  const target = getArg('repo');
  const question = getArg('question');
  if (!target) fail('missing --repo <name> (who to ask)');
  if (!question) fail('missing --question "<text>"');
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const inbox = join(REGISTRY, target, 'inbox');
  ensureDir(inbox);
  const msg = { id, from: REPO_NAME, to: target, question, ts: new Date().toISOString() };
  writeFileSync(join(inbox, `${id}.json`), JSON.stringify(msg, null, 2) + '\n', 'utf8');
  console.log(toon({ repoBridge: { action: 'ask', to: target, id, status: 'queued' } }));
}

function inbox() {
  const dir = join(REGISTRY, REPO_NAME, 'inbox');
  const answersDir = join(REGISTRY, REPO_NAME, 'answers');
  ensureDir(dir);
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(join(dir, f), null))
    .filter(Boolean)
    .filter((m) => !existsSync(join(answersDir, `${m.id}.toon`)))
    .map((m) => ({ id: m.id, from: m.from, question: m.question, ts: m.ts }));
  console.log(toon({ repoBridge: { action: 'inbox', repo: REPO_NAME, pending: pending.length }, questions: pending }));
}

function answer() {
  const id = getArg('id');
  if (!id) fail('missing --id <questionId>');
  let body = '';
  const file = getArg('file');
  const text = getArg('text');
  if (file) {
    if (!existsSync(file)) fail(`--file "${file}" not found`);
    body = readFileSync(file, 'utf8');
  } else if (text) {
    body = text;
  } else {
    fail('provide --file <answer.toon> or --text "<answer>"');
  }
  const answersDir = join(REGISTRY, REPO_NAME, 'answers');
  ensureDir(answersDir);
  writeFileSync(join(answersDir, `${id}.toon`), body.endsWith('\n') ? body : body + '\n', 'utf8');
  console.log(toon({ repoBridge: { action: 'answer', repo: REPO_NAME, id, status: 'answered' } }));
}

function answers() {
  const id = getArg('id');
  if (!id) fail('missing --id <questionId>');
  // Search every repo's answers dir for this id (asker need not know the responder).
  ensureDir(REGISTRY);
  for (const d of readdirSync(REGISTRY, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const p = join(REGISTRY, d.name, 'answers', `${id}.toon`);
    if (existsSync(p)) {
      console.log(toon({ repoBridge: { action: 'answers', id, from: d.name, status: 'ready' } }));
      console.log('\n' + readFileSync(p, 'utf8'));
      return;
    }
  }
  console.log(toon({ repoBridge: { action: 'answers', id, status: 'pending' } }));
  process.exit(1);
}

function query() {
  const name = getArg('repo');
  const match = getArg('match');
  if (!name) fail('missing --repo <name>');
  if (!match) fail('missing --match <term> (scopes the result to matching rows/lines only)');
  const dir = join(REGISTRY, name, 'context');
  if (!existsSync(dir)) fail(`repo "${name}" has no published context. Ask it to run: repo-bridge -- publish`);
  const only = getArg('file');
  const files = (only ? [only] : readdirSync(dir).filter((f) => f.endsWith('.toon')))
    .filter((f) => existsSync(join(dir, f)));
  if (files.length === 0) fail(only ? `file "${only}" not found for repo "${name}"` : `no .toon files published for repo "${name}"`);

  const needle = match.toLowerCase();
  const sections = [];
  let totalHits = 0;
  for (const f of files) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    const kept = [];
    let lastHeader = null;
    for (const line of lines) {
      const isHeader = /^\S/.test(line) || (/^ {2}\S.*:$/.test(line) && !/[,{}]/.test(line));
      if (isHeader) { lastHeader = line; continue; }
      if (line.toLowerCase().includes(needle)) {
        if (lastHeader && kept[kept.length - 1] !== lastHeader) kept.push(lastHeader);
        kept.push(line);
        totalHits += 1;
        lastHeader = null; // header already emitted, avoid dup on next hit in same block
      }
    }
    if (kept.length > 0) sections.push({ file: f, body: kept.join('\n') });
  }
  console.log(toon({ repoBridge: { action: 'query', repo: name, match, filesSearched: files.length, hits: totalHits } }));
  for (const s of sections) console.log(`\n# ${s.file}\n${s.body}`);
}

switch (action) {
  case 'publish': doPublish(); break;
  case 'list': listRepos(); break;
  case 'read': readRepo(); break;
  case 'ask': ask(); break;
  case 'inbox': inbox(); break;
  case 'answer': answer(); break;
  case 'answers': answers(); break;
  case 'query': query(); break;
  default:
    fail(`unknown action "${action || ''}". Use: publish|list|read|ask|inbox|answer|answers|query`);
}
