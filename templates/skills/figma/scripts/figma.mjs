#!/usr/bin/env node
/**
 * Deterministic Figma fetcher. Emits TOON on stdout (caveman FULL).
 *
 * Usage: node figma.mjs --url "https://www.figma.com/design/KEY/Name?node-id=12-34" [--out dir]
 *        node figma.mjs --file KEY --node 12:34 [--out dir]
 * Env:   FIGMA_API_TOKEN
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
function fail(message) { console.log(toon({ error: { skill: 'figma', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

const token = process.env.FIGMA_API_TOKEN;
if (!token) fail('missing env FIGMA_API_TOKEN');

let fileKey = getArg('file');
let nodeId = getArg('node');
const url = getArg('url');
const out = getArg('out');

if (url) {
  const m = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (m) fileKey = m[1];
  const n = url.match(/node-id=([0-9]+-[0-9]+|[0-9]+%3A[0-9]+|[0-9]+:[0-9]+)/);
  if (n) nodeId = decodeURIComponent(n[1]).replace('-', ':');
}
if (!fileKey) fail('could not determine file key (pass --url or --file)');
if (!nodeId) fail('could not determine node id (pass --url with node-id or --node)');

(async () => {
  const headers = { 'X-Figma-Token': token };

  // node metadata (name)
  let name = '';
  try {
    const metaRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      { headers },
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      name = meta.nodes?.[nodeId]?.document?.name || '';
    }
  } catch { /* non-fatal */ }

  // rendered image
  let imageUrl = '';
  try {
    const imgRes = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`,
      { headers },
    );
    if (!imgRes.ok) fail(`http ${imgRes.status} fetching image`);
    const img = await imgRes.json();
    if (img.err) fail(`figma error: ${img.err}`);
    imageUrl = img.images?.[nodeId] || '';
  } catch (e) {
    fail(`request failed: ${e.message}`);
  }
  if (!imageUrl) fail('no image returned for node');

  let savedTo = '';
  if (out && imageUrl) {
    try {
      await mkdir(out, { recursive: true });
      const bin = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
      savedTo = join(out, `${nodeId.replace(':', '-')}.png`);
      await writeFile(savedTo, bin);
    } catch (e) {
      savedTo = `save-failed: ${e.message}`;
    }
  }

  console.log(toon({ figma: { fileKey }, nodes: [{ id: nodeId, name, imageUrl, savedTo }] }));
})();
