#!/usr/bin/env node
/**
 * Deterministic git branch creator following the workflow convention:
 *   <feat|fix|release|chore>/<JIRA-TICKET>_<2-3 word desc>
 * Emits TOON on stdout.
 *
 * Usage: node git-branch.mjs --type feat --ticket FXDOMAIN-0000 --desc "implement agentic cli" [--base default|<ref>] [--pull]
 */
import { execFileSync } from 'node:child_process';

function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  if (s === '' || /[\s,:{}\[\]"]/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"';
  return s;
}
function emit(obj, depth, out) {
  const pad = '  '.repeat(depth);
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) { out.push(`${pad}${k}:`); emit(v, depth + 1, out); }
    else out.push(`${pad}${k}: ${scalar(v)}`);
  }
}
function toon(obj) { const out = []; emit(obj, 0, out); return out.join('\n'); }
function fail(message) { console.log(toon({ error: { skill: 'git-branch', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function git(args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function gitQuiet(args) { execFileSync('git', args, { stdio: 'ignore' }); }

function detectDefaultBranch() {
  try {
    const ref = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
    const name = ref.replace(/^refs\/remotes\/origin\//, '');
    if (name) return name;
  } catch {}
  for (const cand of ['main', 'develop', 'master']) {
    try { git(['rev-parse', '--verify', '--quiet', cand]); return cand; } catch {}
  }
  fail('cannot detect default branch — pass --base <name> explicitly');
}

const TYPES = ['feat', 'fix', 'release', 'chore'];
const type = getArg('type');
const ticket = getArg('ticket');
const desc = getArg('desc');
const baseArg = getArg('base');
const doPull = hasFlag('pull');

if (!TYPES.includes(type)) fail(`--type must be one of ${TYPES.join('|')}`);
if (!ticket || !/^[A-Z][A-Z0-9]+-\d+$/.test(ticket)) fail('--ticket must match [A-Z][A-Z0-9]+-\\d+');
if (!desc || !desc.trim()) fail('--desc required (2-3 words)');

const slug = desc
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .split(/\s+/)
  .slice(0, 3)
  .join('-');
if (!slug) fail('description produced empty slug');

const name = `${type}/${ticket}_${slug}`;

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  fail('not inside a git repository');
}

let resolvedBase = null;
let baseCommit = null;
if (baseArg !== undefined) {
  if (!baseArg || !baseArg.trim()) fail('--base requires a value (branch name or "default")');

  let dirty = '';
  try { dirty = git(['status', '--porcelain', '--untracked-files=no']); } catch (e) { fail(`git status failed: ${e.message}`); }
  if (dirty) fail('refusing to switch base: working tree has uncommitted changes to tracked files — commit or stash first');

  try { gitQuiet(['fetch', 'origin', '--prune']); } catch {}

  resolvedBase = baseArg.trim() === 'default' ? detectDefaultBranch() : baseArg.trim();

  try {
    gitQuiet(['checkout', resolvedBase]);
  } catch {
    try { gitQuiet(['checkout', '-b', resolvedBase, `origin/${resolvedBase}`]); }
    catch (e) { fail(`cannot checkout base "${resolvedBase}" (or origin/${resolvedBase}): ${e.message}`); }
  }

  if (doPull) {
    try { gitQuiet(['pull', '--ff-only', 'origin', resolvedBase]); }
    catch (e) { fail(`git pull --ff-only origin ${resolvedBase} failed (base diverged?) — resolve manually: ${e.message}`); }
  }

  try { baseCommit = git(['rev-parse', 'HEAD']); } catch (e) { fail(`cannot resolve base HEAD: ${e.message}`); }
}

try {
  execFileSync('git', ['checkout', '-b', name], { stdio: 'ignore' });
} catch (e) {
  fail(`git checkout failed: ${e.message}`);
}

const branchOut = { name, created: true };
if (resolvedBase) { branchOut.base = resolvedBase; branchOut.baseCommit = baseCommit; }
console.log(toon({ branch: branchOut }));
