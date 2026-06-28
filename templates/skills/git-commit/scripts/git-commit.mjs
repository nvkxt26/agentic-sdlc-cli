#!/usr/bin/env node
/**
 * Deterministic git commit following the workflow convention:
 *   [JIRA-TICKET]: <description>
 * Emits TOON on stdout.
 *
 * Usage: node git-commit.mjs --ticket FXDOMAIN-0000 --message "add retry" [--all]
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
function fail(message) { console.log(toon({ error: { skill: 'git-commit', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }

const ticket = getArg('ticket');
const message = getArg('message');
if (!ticket || !/^[A-Z][A-Z0-9]+-\d+$/.test(ticket)) fail('--ticket must match [A-Z][A-Z0-9]+-\\d+');
if (!message || !message.trim()) fail('--message required');

const full = `[${ticket}]: ${message.trim()}`;

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  fail('not inside a git repository');
}

if (hasFlag('all')) {
  try { execFileSync('git', ['add', '-A'], { stdio: 'ignore' }); }
  catch (e) { fail(`git add failed: ${e.message}`); }
}

// fail clearly when nothing is staged
const staged = execFileSync('git', ['diff', '--cached', '--name-only']).toString().trim();
if (!staged) fail('nothing staged to commit (use --all or stage changes first)');

try {
  execFileSync('git', ['commit', '-m', full], { stdio: 'ignore' });
} catch (e) {
  fail(`git commit failed: ${e.message}`);
}

const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
console.log(toon({ commit: { message: full, committed: true, hash } }));
