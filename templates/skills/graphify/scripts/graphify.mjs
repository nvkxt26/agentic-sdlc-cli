#!/usr/bin/env node
/**
 * Deterministic wrapper around the third-party `graphify` CLI (graphifyy on
 * PyPI: https://github.com/Graphify-Labs/graphify). Optional knowledge-graph
 * layer on top of the flat TOON codebase context — every action fails soft
 * (TOON `error`/`available: false`) when the CLI or graph isn't present, so
 * callers (context-builder, mimir) can fall back to the TOON docs.
 *
 * Usage:
 *   node graphify.mjs status
 *   node graphify.mjs build [--update]
 *   node graphify.mjs query "<question>"
 *   node graphify.mjs path "<A>" "<B>"
 *   node graphify.mjs explain "<name>"
 *
 * Pure child_process + fs, zero npm dependencies.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(`${pad}${k}:`);
      emit(v, depth + 1, out);
    } else if (typeof v === 'string' && v.includes('\n')) {
      out.push(`${pad}${k}: |`);
      for (const line of v.split('\n')) out.push(`${pad}  ${line}`);
    } else {
      out.push(`${pad}${k}: ${scalar(v)}`);
    }
  }
}
function toon(obj) {
  const out = [];
  emit(obj, 0, out);
  return out.join('\n');
}
function fail(action, message, extra = {}) {
  console.log(toon({ graphify: { action, available: false, error: message, ...extra } }));
  process.exit(1);
}

const cwd = process.cwd();
const GRAPH_PATH = join(cwd, 'graphify-out', 'graph.json');
const INSTALL_HINT = 'uv tool install graphifyy && graphify install';

function isGraphifyOnPath() {
  try {
    execFileSync('graphify', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runGraphify(args, opts = {}) {
  return execFileSync('graphify', args, { encoding: 'utf8', cwd, ...opts });
}

const [, , action, ...rest] = process.argv;

if (!action) fail('unknown', 'no action given; use status|build|query|path|explain');

if (!isGraphifyOnPath()) {
  fail(action, 'graphify CLI not found on PATH', { installHint: INSTALL_HINT });
}

switch (action) {
  case 'status': {
    const graphExists = existsSync(GRAPH_PATH);
    console.log(
      toon({
        graphify: {
          action: 'status',
          available: true,
          graphBuilt: graphExists,
          graphPath: graphExists ? 'graphify-out/graph.json' : null,
        },
      }),
    );
    break;
  }

  case 'build': {
    const update = rest.includes('--update');
    const args = ['extract', '.', '--no-viz'];
    if (update) args.push('--update');
    try {
      const out = runGraphify(args);
      console.log(
        toon({
          graphify: {
            action: 'build',
            available: true,
            mode: update ? 'update' : 'full',
            graphPath: 'graphify-out/graph.json',
          },
          result: out.trim(),
        }),
      );
    } catch (e) {
      fail('build', `graphify extract failed: ${e.message}`);
    }
    break;
  }

  case 'query': {
    const question = rest.filter((a) => !a.startsWith('--')).join(' ');
    if (!question.trim()) fail('query', '--question text required (positional arg after "query")');
    if (!existsSync(GRAPH_PATH)) {
      fail('query', 'no graph built yet — run `agentic-sdlc run graphify -- build` first', {
        installHint: INSTALL_HINT,
      });
    }
    try {
      const out = runGraphify(['query', question]);
      console.log(
        toon({
          graphify: { action: 'query', available: true, graphPath: 'graphify-out/graph.json', question },
          result: out.trim(),
        }),
      );
    } catch (e) {
      fail('query', `graphify query failed: ${e.message}`);
    }
    break;
  }

  case 'path': {
    const [from, to] = rest.filter((a) => !a.startsWith('--'));
    if (!from || !to) fail('path', 'two positional args required: "<from>" "<to>"');
    if (!existsSync(GRAPH_PATH)) {
      fail('path', 'no graph built yet — run `agentic-sdlc run graphify -- build` first');
    }
    try {
      const out = runGraphify(['path', from, to]);
      console.log(
        toon({
          graphify: { action: 'path', available: true, graphPath: 'graphify-out/graph.json', from, to },
          result: out.trim(),
        }),
      );
    } catch (e) {
      fail('path', `graphify path failed: ${e.message}`);
    }
    break;
  }

  case 'explain': {
    const name = rest.filter((a) => !a.startsWith('--')).join(' ');
    if (!name.trim()) fail('explain', 'positional arg required: "<name>"');
    if (!existsSync(GRAPH_PATH)) {
      fail('explain', 'no graph built yet — run `agentic-sdlc run graphify -- build` first');
    }
    try {
      const out = runGraphify(['explain', name]);
      console.log(
        toon({
          graphify: { action: 'explain', available: true, graphPath: 'graphify-out/graph.json', name },
          result: out.trim(),
        }),
      );
    } catch (e) {
      fail('explain', `graphify explain failed: ${e.message}`);
    }
    break;
  }

  default:
    fail(action, `unknown action "${action}"; use status|build|query|path|explain`);
}
