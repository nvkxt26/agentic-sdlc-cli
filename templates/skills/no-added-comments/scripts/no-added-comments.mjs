#!/usr/bin/env node
/**
 * Flags newly-added inline explanatory comments in a git diff. Emits TOON.
 * Classifies added comment lines as `doc` (JSDoc/docblock/continuation that
 * documents a function/class/structure — allowed, reported informationally) or
 * `inline` (line-level explanation of code below — the violation). Only inline
 * comments fail the gate.
 * Usage: node no-added-comments.mjs [--staged | --range <expr>] [--warn-only]
 */
import { execFileSync } from 'node:child_process';

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
function fail(message) { console.log(toon({ error: { skill: 'no-added-comments', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }

const SLASH = new Set(['js','jsx','ts','tsx','mjs','cjs','java','c','h','cpp','hpp','cc','cs','go','rs','swift','kt','kts','scala','php','dart','groovy']);
const HASH = new Set(['py','rb','sh','bash','zsh','yaml','yml','toml','ps1']);
const CSS = new Set(['css','scss','less']);
const HTML = new Set(['html','xml','vue','svelte']);
const SKIP = new Set(['md','markdown','toon','json','lock','txt','csv','svg','png','jpg','jpeg','gif','ico','lockb']);

function extOf(file) {
  const base = file.split('/').pop() || file;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}
function commentKind(ext, text, state) {
  const t = text.trim();
  if (!t) return null;
  if (state.inBlock) {
    if (t.includes('*/')) state.inBlock = false;
    return state.blockKind;
  }
  if (SLASH.has(ext)) {
    if (t.startsWith('/**')) {
      if (!t.includes('*/')) { state.inBlock = true; state.blockKind = 'doc'; }
      return 'doc';
    }
    if (t.startsWith('/*')) {
      if (t.includes('*/')) return 'inline';
      state.inBlock = true; state.blockKind = 'doc';
      return 'doc';
    }
    if (t.startsWith('*/') || t.startsWith('*')) return 'doc';
    if (t.startsWith('//')) return 'inline';
    return null;
  }
  if (CSS.has(ext)) {
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) { state.inBlock = true; state.blockKind = 'inline'; }
      return 'inline';
    }
    if (t.startsWith('*/') || t.startsWith('*')) return 'inline';
    return null;
  }
  if (HASH.has(ext)) return t.startsWith('#') ? 'inline' : null;
  if (HTML.has(ext)) return t.startsWith('<!--') ? 'inline' : null;
  return null;
}

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  fail('not inside a git repository');
}

const range = getArg('range');
const scope = range ? range : 'staged';
const diffArgs = range ? ['diff', '--no-color', range] : ['diff', '--no-color', '--cached'];

let raw;
try {
  raw = execFileSync('git', diffArgs, { encoding: 'utf8' });
} catch (e) {
  fail(`git diff failed: ${e.message}`);
}

const lines = raw.split('\n');
let currentFile = null;
let ext = '';
let newLineNo = 0;
let scanning = false;
const blockState = { inBlock: false, blockKind: null };
const scannedFiles = new Set();
const inlineViolations = [];
const docComments = [];

for (const line of lines) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6);
    ext = extOf(currentFile);
    scanning = !SKIP.has(ext) && (SLASH.has(ext) || HASH.has(ext) || CSS.has(ext) || HTML.has(ext));
    blockState.inBlock = false;
    blockState.blockKind = null;
    continue;
  }
  if (line.startsWith('@@')) {
    const m = /\+(\d+)/.exec(line);
    newLineNo = m ? parseInt(m[1], 10) : 0;
    blockState.inBlock = false;
    blockState.blockKind = null;
    continue;
  }
  if (!scanning || !currentFile) continue;
  if (line.startsWith('+') && !line.startsWith('+++')) {
    const text = line.slice(1);
    scannedFiles.add(currentFile);
    const kind = commentKind(ext, text, blockState);
    if (kind === 'inline') {
      inlineViolations.push({ file: currentFile, line: newLineNo, text: text.trim() });
    } else if (kind === 'doc') {
      docComments.push({ file: currentFile, line: newLineNo, text: text.trim() });
    }
    newLineNo++;
  } else if (!line.startsWith('-') && !line.startsWith('\\')) {
    newLineNo++;
  }
}

const summary = {
  noAddedComments: {
    scope,
    scannedFiles: scannedFiles.size,
    inlineViolationCount: inlineViolations.length,
    docCommentCount: docComments.length,
  },
  inlineViolations,
  docComments,
};
console.log(toon(summary));
if (inlineViolations.length && !hasFlag('warn-only')) process.exit(1);
