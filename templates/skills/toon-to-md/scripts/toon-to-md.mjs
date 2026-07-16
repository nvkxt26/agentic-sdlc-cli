#!/usr/bin/env node
/**
 * Deterministic TOON → Markdown renderer (Layer 1 structural render).
 *
 * Turns a caveman-FULL TOON hand-off artifact (requirements/plan/dev-report/…)
 * into a readable Markdown document by a pure 1:1 grammar transform. It does NOT
 * de-caveman fragments into prose (that is lossy decompression and needs an
 * agent); it renders the structure faithfully:
 *   - scalar `k: v`                 → `- **k:** v`
 *   - nested object                 → heading + nested render
 *   - primitive array (inline / -)  → bullet list
 *   - tabular array `k[N]{f..}:`     → Markdown table
 *   - empty array `k[0]:`           → `_none_`
 *
 * Usage:
 *   node toon-to-md.mjs --file plan.toon [--out plan.md] [--title "Plan"]
 *   node toon-to-md.mjs --in  plan.toon               # alias for --file
 *   cat plan.toon | node toon-to-md.mjs               # stdin → stdout
 *
 * With --out: writes the Markdown file and prints a TOON status block.
 * Without --out: prints Markdown to stdout (pipe-friendly).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

// ---- tiny TOON encoder (for status / error output only) ---------------------
function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (s === '' || /[\s,:{}\[\]"]/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"';
  return s;
}
function emitToon(obj, depth, out) {
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
      out.push(`${pad}${k}:`); emitToon(v, depth + 1, out);
    } else {
      out.push(`${pad}${k}: ${scalar(v)}`);
    }
  }
}
function toon(obj) { const out = []; emitToon(obj, 0, out); return out.join('\n'); }
function fail(message) { console.log(toon({ error: { skill: 'toon-to-md', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

// Table layout: 'auto' (default) picks aligned table for narrow data and
// sections for wide/long-text rows; 'table' forces aligned tables; 'sections'
// forces one sub-section per row.
const LAYOUT = (() => {
  const v = (getArg('layout') ?? 'auto').toLowerCase();
  return ['auto', 'table', 'sections'].includes(v) ? v : 'auto';
})();

// ---- TOON parsing helpers ---------------------------------------------------
function unquote(raw) {
  const s = raw.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

/** Split on top-level commas, ignoring commas inside double quotes. */
function splitCommas(str) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' && str[i - 1] !== '\\') inQuote = !inQuote;
    if (c === ',' && !inQuote) { cells.push(cur); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur);
  return cells;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

const KEY_RE = /^([^:[{]+)(\[(\d+)\])?(\{([^}]*)\})?:(.*)$/;

/**
 * Indentation-based recursive-descent parser. Handles scalars, nested objects,
 * inline & `-` block primitive arrays, and `{fields}` tabular arrays. Lenient:
 * a declared `[N]` count that disagrees with the actual rows is ignored.
 */
function parseToon(text) {
  const lines = text
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'));
  let i = 0;

  function parseObject(minIndent) {
    const obj = {};
    while (i < lines.length) {
      const line = lines[i];
      const ind = indentOf(line);
      if (ind !== minIndent) break; // deeper lines are consumed by children
      const m = line.trim().match(KEY_RE);
      if (!m) { i++; continue; }

      const key = m[1].trim();
      const hasArr = m[2] !== undefined;
      const fields = m[5];
      const rest = m[6].trim();
      i++;

      if (fields !== undefined) {
        // tabular array: read all deeper rows as comma records
        const fieldList = splitCommas(fields).map((f) => f.trim());
        const rows = [];
        const last = fieldList.length - 1;
        while (i < lines.length && indentOf(lines[i]) > minIndent) {
          const cells = splitCommas(lines[i].trim());
          const row = {};
          fieldList.forEach((f, idx) => {
            // last field absorbs overflow so unquoted commas in the final
            // column are not truncated
            const raw = idx === last ? cells.slice(idx).join(',') : cells[idx];
            row[f] = unquote(raw ?? '');
          });
          rows.push(row);
          i++;
        }
        obj[key] = rows;
      } else if (hasArr) {
        if (rest !== '') {
          obj[key] = splitCommas(rest).map(unquote);
        } else {
          const items = [];
          while (i < lines.length && indentOf(lines[i]) > minIndent) {
            const cl = lines[i].trim();
            if (cl.startsWith('- ')) { items.push(unquote(cl.slice(2))); i++; }
            else break;
          }
          obj[key] = items;
        }
      } else if (rest !== '') {
        obj[key] = unquote(rest);
      } else {
        obj[key] = parseObject(minIndent + 2);
      }
    }
    return obj;
  }

  return parseObject(0);
}

// ---- Markdown rendering -----------------------------------------------------
function titleCase(s) {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function cell(v) { return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

// Layout thresholds for `auto`: fall back to sections when a pipe table would
// be too wide to read as raw text.
const MAX_TABLE_WIDTH = 120; // total rendered row width
const MAX_CELL_WIDTH = 60; // any single cell

function displayWidth(s) { return [...s].length; }

/** Column-aligned Markdown table: every cell padded to its column width. */
function renderAlignedTable(rows, out) {
  const cols = Object.keys(rows[0]);
  const headers = cols.map(titleCase);
  const widths = cols.map((c, idx) => {
    let w = displayWidth(headers[idx]);
    for (const row of rows) w = Math.max(w, displayWidth(cell(row[c] ?? '')));
    return Math.max(w, 3);
  });
  const pad = (s, w) => s + ' '.repeat(w - displayWidth(s));
  out.push(`| ${headers.map((h, idx) => pad(h, widths[idx])).join(' | ')} |`);
  out.push(`| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`);
  for (const row of rows) {
    out.push(`| ${cols.map((c, idx) => pad(cell(row[c] ?? ''), widths[idx])).join(' | ')} |`);
  }
  out.push('');
}

/** Sequential layout: one sub-section per row, column names as bold labels. */
function renderSections(rows, level, out) {
  const cols = Object.keys(rows[0]);
  // Prefer an id-ish first column as the row heading label.
  const idCol = cols[0];
  rows.forEach((row, n) => {
    const label = String(row[idCol] ?? n + 1).trim();
    heading(Math.min(level, 6), `${titleCase(idCol)} ${label}`, out);
    for (const c of cols) {
      if (c === idCol) continue;
      out.push(`- **${titleCase(c)}:** ${cell(row[c] ?? '')}`);
    }
    out.push('');
  });
}

/** Decide whether an aligned pipe table stays readable as raw text. */
function tableFits(rows) {
  const cols = Object.keys(rows[0]);
  let total = 1;
  for (const c of cols) {
    let w = displayWidth(titleCase(c));
    for (const row of rows) {
      const cw = displayWidth(cell(row[c] ?? ''));
      if (cw > MAX_CELL_WIDTH) return false;
      w = Math.max(w, cw);
    }
    total += w + 3;
  }
  return total <= MAX_TABLE_WIDTH;
}

function renderRows(rows, level, out) {
  if (LAYOUT === 'sections') { renderSections(rows, level, out); return; }
  if (LAYOUT === 'table') { renderAlignedTable(rows, out); return; }
  // auto
  if (tableFits(rows)) renderAlignedTable(rows, out);
  else renderSections(rows, level, out);
}

function heading(level, text, out) {
  out.push(`${'#'.repeat(Math.min(level, 6))} ${text}`);
  out.push('');
}

function renderObject(obj, level, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      const count = v.length ? ` (${v.length})` : '';
      heading(level, `${titleCase(k)}${count}`, out);
      if (v.length === 0) { out.push('_none_', ''); continue; }
      if (v.every(isObj)) renderRows(v, level + 1, out);
      else { for (const item of v) out.push(`- ${cell(item)}`); out.push(''); }
    } else if (isObj(v)) {
      heading(level, titleCase(k), out);
      renderObject(v, level + 1, out);
    } else {
      out.push(`- **${titleCase(k)}:** ${v}`);
    }
  }
  // ensure a blank line after a run of scalar bullets
  if (out.length && out[out.length - 1] !== '') out.push('');
}

function render(root, title) {
  const out = [`# ${title}`, ''];
  // unwrap a single-key object wrapper for a cleaner document
  const keys = Object.keys(root);
  let body = root;
  if (keys.length === 1 && isObj(root[keys[0]])) {
    heading(2, titleCase(keys[0]), out);
    body = root[keys[0]];
    renderObject(body, 3, out);
  } else {
    renderObject(body, 2, out);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// ---- optional prose (Layer 2) ----------------------------------------------
// The script itself is deterministic and does NOT call a model. Prose
// de-cavemanning is a light-tier model step performed by the agent between
// these two deterministic phases:
//   1. --prose-extract  → emit caveman leaf fragments + protected tokens (TOON)
//   2. (agent: light model rewrites each fragment to plain prose)
//   3. --prose-apply --map <file> → substitute rewrites, revert any that drop a
//      protected token (deterministic guard), then render Markdown.

/** Visit every string leaf (scalars, primitive-array items, table cells) in a
 *  stable DFS order, giving each a get/set handle so rewrites can be applied. */
function walkLeaves(node, visit) {
  if (Array.isArray(node)) {
    node.forEach((item, idx) => {
      if (item !== null && typeof item === 'object') walkLeaves(item, visit);
      else if (typeof item === 'string') visit(item, (nv) => { node[idx] = nv; });
    });
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v !== null && typeof v === 'object') walkLeaves(v, visit);
      else if (typeof v === 'string') visit(v, (nv) => { node[k] = nv; });
    }
  }
}

/** Tokens that MUST survive de-cavemanning verbatim: identifiers, paths, file
 *  names, code, requirement ids, key:value literals, generics. */
function protectedTokens(text) {
  const out = [];
  for (const rawTok of text.split(/\s+/)) {
    const t = rawTok.replace(/^[("']+|[)"',.;:]+$/g, '');
    if (!t) continue;
    if (
      /[\/\\]/.test(t) ||             // paths: src/types.ts
      /\w\.\w/.test(t) ||             // file.ext, a.b.c
      /[A-Z]{2,}-?\d+/.test(t) ||     // REQ-9, ABC123
      /[a-z][A-Za-z]*[A-Z]/.test(t) || // camelCase: autoApprove
      /[A-Z][a-z]+[A-Z]/.test(t) ||   // PascalCaseish
      /[:=]/.test(t) ||               // autoApprove:false, k=v
      /\(\)$/.test(t) ||              // fn()
      /^[A-Z]{2,}$/.test(t) ||        // MANDATORY, ALL
      /[{}\[\]<>]/.test(t)            // brackets / generics
    ) {
      out.push(t);
    }
  }
  return [...new Set(out)];
}

/** A leaf worth de-cavemanning = multi-word free text (single tokens are pure
 *  identifiers with nothing to rewrite). */
function isProseCandidate(text) {
  return /\s/.test(text.trim()) && text.trim().length > 3;
}

/** Phase 1: collect prose tasks in stable order. */
function extractProseTasks(root) {
  const tasks = [];
  let n = 0;
  walkLeaves(root, (text) => {
    n++;
    if (!isProseCandidate(text)) return;
    tasks.push({ id: `L${n}`, protect: protectedTokens(text).join('|'), text });
  });
  return tasks;
}

/** Phase 3: apply rewrites by id with the token-preservation guard. */
function applyProse(root, rewrites) {
  let applied = 0;
  let reverted = 0;
  let n = 0;
  walkLeaves(root, (text, set) => {
    n++;
    const id = `L${n}`;
    const rewrite = rewrites[id];
    if (rewrite === undefined || !isProseCandidate(text)) return;
    const clean = rewrite.trim();
    const kept = protectedTokens(text).every((tok) => clean.includes(tok));
    if (clean && kept) { set(clean); applied++; }
    else reverted++;
  });
  return { applied, reverted };
}

// ---- main -------------------------------------------------------------------
function readInput() {
  const file = getArg('file') ?? getArg('in');
  if (file) {
    if (!existsSync(file)) fail(`--file not found: ${file}`);
    return { text: readFileSync(file, 'utf8'), file };
  }
  const stdin = readFileSync(0, 'utf8');
  if (!stdin.trim()) fail('provide --file <path> or pipe TOON on stdin');
  return { text: stdin, file: undefined };
}

const { text, file } = readInput();
let parsed;
try {
  parsed = parseToon(text);
} catch (err) {
  fail(`parse failed: ${err.message}`);
}
if (!parsed || Object.keys(parsed).length === 0) fail('no TOON content parsed');

const title = getArg('title') ?? (file ? titleCase(basename(file).replace(/\.toon$/i, '')) : 'Document');

// Phase 1: emit prose tasks for a light-tier model to rewrite, then stop.
if (process.argv.includes('--prose-extract')) {
  const tasks = extractProseTasks(parsed);
  console.log(
    toon({
      proseExtract: {
        source: file ?? 'stdin',
        count: tasks.length,
        note: 'rewrite each text to one plain-prose sentence; every token in protect MUST appear verbatim; add no information',
      },
      tasks,
    }),
  );
  process.exit(0);
}

// Phase 3: apply model rewrites (with token-preservation guard) before render.
let proseStats;
const mapPath = getArg('prose-apply') ?? getArg('map');
if (process.argv.includes('--prose-apply') || getArg('map')) {
  if (!mapPath || !existsSync(mapPath)) fail('--prose-apply/--map requires an existing rewrites file');
  let rewritesDoc;
  try {
    rewritesDoc = parseToon(readFileSync(mapPath, 'utf8'));
  } catch (err) {
    fail(`prose map parse failed: ${err.message}`);
  }
  const rows = Array.isArray(rewritesDoc?.rewrites) ? rewritesDoc.rewrites : [];
  if (rows.length === 0) fail('prose map has no rewrites[]{id,text} rows');
  const map = {};
  for (const r of rows) if (r.id) map[r.id] = r.text ?? '';
  proseStats = applyProse(parsed, map);
}

const md = render(parsed, title);

const outPath = getArg('out');
if (outPath) {
  writeFileSync(outPath, md, 'utf8');
  const status = { action: 'render', out: outPath, bytes: Buffer.byteLength(md), title };
  if (proseStats) { status.proseApplied = proseStats.applied; status.proseReverted = proseStats.reverted; }
  console.log(toon({ toonToMd: status }));
} else {
  process.stdout.write(md);
}
