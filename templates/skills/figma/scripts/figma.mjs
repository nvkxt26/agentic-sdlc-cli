#!/usr/bin/env node
/**
 * Deterministic Figma fetcher. Emits TOON on stdout (caveman FULL).
 *
 * Beyond the rendered PNG, it walks the node document tree and extracts
 * structured design tokens — layout/position, typography (incl. font weight),
 * colors, icons (with SVG export), and shadows — so downstream implementation
 * has exact values instead of eyeballing an image.
 *
 * Usage: node figma.mjs --url "https://www.figma.com/design/KEY/Name?node-id=12-34" [--out dir] [--max N] [--no-assets]
 *        node figma.mjs --file KEY --node 12:34 [--out dir]
 * Env:   FIGMA_API_TOKEN
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

// ---- pure helpers (exported for tests) --------------------------------------
export function round(n, d = 0) {
  const f = 10 ** d;
  return Math.round((Number(n) || 0) * f) / f;
}

/** Parse a Figma link into {fileKey, nodeId}. */
export function parseFigmaTarget(url) {
  const res = { fileKey: '', nodeId: '' };
  if (!url) return res;
  const m = url.match(/figma\.com\/(?:file|design|board)\/([A-Za-z0-9]+)/);
  if (m) res.fileKey = m[1];
  const n = url.match(/node-id=([0-9]+-[0-9]+|[0-9]+%3A[0-9]+|[0-9]+:[0-9]+)/);
  if (n) res.nodeId = decodeURIComponent(n[1]).replace('-', ':');
  return res;
}

/** Figma 0..1 rgb → #RRGGBB (alpha reported separately as opacity). */
export function rgbaToHex(c) {
  if (!c) return '';
  const to = (x) => Math.round((x ?? 0) * 255).toString(16).padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`.toUpperCase();
}

/** First visible SOLID paint → {hex, opacity}; null otherwise. */
export function fillColor(paints) {
  if (!Array.isArray(paints)) return null;
  const p = paints.find((x) => x && x.visible !== false && x.type === 'SOLID' && x.color);
  if (!p) return null;
  const a = (p.opacity != null ? p.opacity : 1) * (p.color.a != null ? p.color.a : 1);
  return { hex: rgbaToHex(p.color), opacity: round(a, 2) };
}

/** Node bounding box made relative to a frame origin, rounded. */
export function relBox(box, origin) {
  if (!box) return { x: '', y: '', w: '', h: '' };
  const ox = origin?.x || 0;
  const oy = origin?.y || 0;
  return { x: round(box.x - ox), y: round(box.y - oy), w: round(box.width), h: round(box.height) };
}

/** Typography values for a TEXT node (font weight is the key gap we close). */
export function textStyleOf(node) {
  const s = (node && node.style) || {};
  return {
    font: s.fontFamily || '',
    weight: s.fontWeight || '',
    size: s.fontSize ? round(s.fontSize) : '',
    lineHeight: s.lineHeightPx ? round(s.lineHeightPx) : '',
    letterSpacing: s.letterSpacing ? round(s.letterSpacing, 2) : 0,
    case: s.textCase || 'NONE',
    align: s.textAlignHorizontal || '',
  };
}

/** Heuristic: is this node an icon (vector art or an icon-named component)? */
export function isIconNode(node) {
  if (!node) return false;
  const t = node.type;
  if (t === 'VECTOR' || t === 'BOOLEAN_OPERATION') return true;
  const name = (node.name || '').toLowerCase();
  const iconish = /(^|[^a-z])icon([^a-z]|$)|(^|[^a-z])ic[-_]/.test(name);
  return iconish && /INSTANCE|COMPONENT|FRAME|GROUP/.test(t);
}

/**
 * Walk a Figma node subtree and collect structured design tokens.
 * Returns { frames, typography, icons, effects, colors }, each an array of
 * uniform scalar-valued rows suited to the TOON encoder.
 */
export function collectDesign(root, { max = 300 } = {}) {
  const origin = (root && root.absoluteBoundingBox) || { x: 0, y: 0 };
  const frames = [];
  const typography = [];
  const icons = [];
  const effects = [];
  const colors = new Map();
  let count = 0;

  const addColor = (hex, opacity, usage) => {
    if (!hex) return;
    const key = `${hex}@${opacity}`;
    const e = colors.get(key) || { hex, opacity, usages: new Set(), count: 0 };
    e.usages.add(usage);
    e.count += 1;
    colors.set(key, e);
  };

  const addEffects = (node, box) => {
    for (const ef of node.effects || []) {
      if (ef.visible === false || !/SHADOW/.test(ef.type || '')) continue;
      effects.push({
        id: node.id,
        name: node.name || '',
        type: ef.type,
        color: ef.color ? rgbaToHex(ef.color) : '',
        x: round(ef.offset?.x || 0),
        y: round(ef.offset?.y || 0),
        blur: round(ef.radius || 0),
        spread: round(ef.spread || 0),
      });
    }
  };

  function walk(node) {
    if (!node || count > max) return;
    count += 1;
    const box = relBox(node.absoluteBoundingBox, origin);
    addEffects(node, box);

    if (isIconNode(node)) {
      icons.push({ id: node.id, name: node.name || '', type: node.type, x: box.x, y: box.y, w: box.w, h: box.h, svgUrl: '', savedTo: '' });
      const fc = fillColor(node.fills);
      if (fc) addColor(fc.hex, fc.opacity, 'icon');
      return; // atomic — do not descend into icon internals
    }

    if (node.type === 'TEXT') {
      const st = textStyleOf(node);
      const fc = fillColor(node.fills);
      typography.push({
        id: node.id,
        name: node.name || '',
        text: (node.characters || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        font: st.font,
        weight: st.weight,
        size: st.size,
        lineHeight: st.lineHeight,
        letterSpacing: st.letterSpacing,
        case: st.case,
        align: st.align,
        color: fc ? fc.hex : '',
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
      });
      if (fc) addColor(fc.hex, fc.opacity, 'text');
    } else if (/FRAME|GROUP|COMPONENT|INSTANCE|SECTION|RECTANGLE|ELLIPSE/.test(node.type)) {
      frames.push({
        id: node.id,
        name: node.name || '',
        type: node.type,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        layout: node.layoutMode || 'NONE',
        gap: round(node.itemSpacing || 0),
        padLeft: round(node.paddingLeft || 0),
        padTop: round(node.paddingTop || 0),
        padRight: round(node.paddingRight || 0),
        padBottom: round(node.paddingBottom || 0),
        radius: round(node.cornerRadius || 0),
        align: `${node.primaryAxisAlignItems || '-'}/${node.counterAxisAlignItems || '-'}`,
        visible: node.visible !== false,
      });
      const fc = fillColor(node.fills);
      if (fc) addColor(fc.hex, fc.opacity, 'fill');
    }

    const sc = fillColor(node.strokes);
    if (sc) addColor(sc.hex, sc.opacity, 'stroke');

    for (const ch of node.children || []) walk(ch);
  }

  walk(root);

  const colorRows = [...colors.values()]
    .map((v) => ({ hex: v.hex, opacity: v.opacity, usage: [...v.usages].join('|'), count: v.count }))
    .sort((a, b) => b.count - a.count);

  return { frames, typography, icons, effects, colors: colorRows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.FIGMA_API_TOKEN;
  if (!token) fail('missing env FIGMA_API_TOKEN');

  let fileKey = getArg('file');
  let nodeId = getArg('node');
  const url = getArg('url');
  const out = getArg('out');
  const maxNodes = Number(getArg('max')) || 300;
  const noAssets = process.argv.includes('--no-assets');

  if (url) {
    const t = parseFigmaTarget(url);
    if (t.fileKey) fileKey = t.fileKey;
    if (t.nodeId) nodeId = t.nodeId;
  }
  if (!fileKey) fail('could not determine file key (pass --url or --file)');
  if (!nodeId) fail('could not determine node id (pass --url with node-id or --node)');

  const headers = { 'X-Figma-Token': token };

  (async () => {
    // node document tree (name + structured tokens)
    let document = null;
    let name = '';
    try {
      const metaRes = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
        { headers },
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        document = meta.nodes?.[nodeId]?.document || null;
        name = document?.name || '';
      }
    } catch { /* non-fatal */ }

    // rendered image (unchanged behavior)
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

    const design = document
      ? collectDesign(document, { max: maxNodes })
      : { frames: [], typography: [], icons: [], effects: [], colors: [] };

    // export icon SVGs so icons are created/picked up rather than lost
    if (!noAssets && design.icons.length) {
      const ids = design.icons.map((i) => i.id).slice(0, 60);
      try {
        const svgRes = await fetch(
          `https://api.figma.com/v1/images/${fileKey}?ids=${ids.map(encodeURIComponent).join(',')}&format=svg`,
          { headers },
        );
        if (svgRes.ok) {
          const svg = await svgRes.json();
          for (const ic of design.icons) {
            ic.svgUrl = svg.images?.[ic.id] || '';
            if (out && ic.svgUrl) {
              try {
                await mkdir(out, { recursive: true });
                const bin = Buffer.from(await (await fetch(ic.svgUrl)).arrayBuffer());
                const fn = `${(ic.name || 'icon').replace(/[^\w.-]+/g, '-').slice(0, 40)}-${ic.id.replace(':', '-')}.svg`;
                const p = join(out, fn);
                await writeFile(p, bin);
                ic.savedTo = p;
              } catch (e) {
                ic.savedTo = `save-failed: ${e.message}`;
              }
            }
          }
        }
      } catch { /* non-fatal */ }
    }

    const rootBox = document?.absoluteBoundingBox;
    const result = {
      figma: {
        fileKey,
        node: nodeId,
        name,
        width: rootBox ? round(rootBox.width) : '',
        height: rootBox ? round(rootBox.height) : '',
      },
      nodes: [{ id: nodeId, name, imageUrl, savedTo }],
    };
    if (design.frames.length) result.frames = design.frames;
    if (design.typography.length) result.typography = design.typography;
    if (design.colors.length) result.colors = design.colors;
    if (design.icons.length) result.icons = design.icons;
    if (design.effects.length) result.effects = design.effects;

    console.log(toon(result));
  })();
}
