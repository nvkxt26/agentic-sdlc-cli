import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const figmaScript = join(repoRoot, 'templates/skills/figma/scripts/figma.mjs');

function runFigma(args: string[], env: NodeJS.ProcessEnv = process.env): { code: number; out: string } {
  try {
    const out = execFileSync('node', [figmaScript, ...args], { cwd: repoRoot, encoding: 'utf8', env });
    return { code: 0, out };
  } catch (e: any) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('figma skill CLI guard', () => {
  it('fails with TOON error when FIGMA_API_TOKEN missing', () => {
    const env = { ...process.env };
    delete env['FIGMA_API_TOKEN'];
    const { code, out } = runFigma(['--url', 'https://www.figma.com/design/ABC/Name?node-id=1-2'], env);
    expect(code).not.toBe(0);
    expect(out).toContain('error:');
    expect(out).toContain('skill: figma');
    expect(out).toContain('FIGMA_API_TOKEN');
  });
});

describe('parseFigmaTarget', () => {
  it('parses design link with node-id (dash form)', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    expect(mod.parseFigmaTarget('https://www.figma.com/design/ABC123/Name?node-id=12-34')).toEqual({
      fileKey: 'ABC123',
      nodeId: '12:34',
    });
  });

  it('parses file link and url-encoded node-id', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    expect(mod.parseFigmaTarget('https://www.figma.com/file/KEY/X?node-id=5%3A6')).toEqual({
      fileKey: 'KEY',
      nodeId: '5:6',
    });
  });

  it('returns empty target for non-figma url', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    expect(mod.parseFigmaTarget('https://example.com')).toEqual({ fileKey: '', nodeId: '' });
    expect(mod.parseFigmaTarget(undefined as unknown as string)).toEqual({ fileKey: '', nodeId: '' });
  });
});

describe('color + geometry helpers', () => {
  it('rgbaToHex converts 0..1 channels to #RRGGBB', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    expect(mod.rgbaToHex({ r: 1, g: 0, b: 0 })).toBe('#FF0000');
    expect(mod.rgbaToHex({ r: 0, g: 0.5019607843, b: 0 })).toBe('#008000');
    expect(mod.rgbaToHex(null)).toBe('');
  });

  it('fillColor picks first visible SOLID paint with combined opacity', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    const paints = [
      { type: 'SOLID', visible: false, color: { r: 0, g: 0, b: 0 } },
      { type: 'SOLID', opacity: 0.5, color: { r: 0, g: 0, b: 1, a: 1 } },
    ];
    expect(mod.fillColor(paints)).toEqual({ hex: '#0000FF', opacity: 0.5 });
    expect(mod.fillColor([{ type: 'GRADIENT_LINEAR' }])).toBeNull();
    expect(mod.fillColor(undefined)).toBeNull();
  });

  it('relBox makes box relative to origin and rounds', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    expect(mod.relBox({ x: 120.4, y: 60.6, width: 100.2, height: 40.9 }, { x: 100, y: 50 })).toEqual({
      x: 20,
      y: 11,
      w: 100,
      h: 41,
    });
    expect(mod.relBox(null, { x: 0, y: 0 })).toEqual({ x: '', y: '', w: '', h: '' });
  });
});

describe('typography + icon detection', () => {
  it('textStyleOf surfaces font weight and metrics', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    const node = {
      style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 28, lineHeightPx: 34, letterSpacing: 0.25, textAlignHorizontal: 'LEFT' },
    };
    expect(mod.textStyleOf(node)).toEqual({
      font: 'Inter',
      weight: 700,
      size: 28,
      lineHeight: 34,
      letterSpacing: 0.25,
      case: 'NONE',
      align: 'LEFT',
    });
  });

  it('isIconNode detects vectors and icon-named components', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    expect(mod.isIconNode({ type: 'VECTOR', name: 'path' })).toBe(true);
    expect(mod.isIconNode({ type: 'BOOLEAN_OPERATION', name: 'union' })).toBe(true);
    expect(mod.isIconNode({ type: 'INSTANCE', name: 'icon/search' })).toBe(true);
    expect(mod.isIconNode({ type: 'COMPONENT', name: 'ic_home' })).toBe(true);
    expect(mod.isIconNode({ type: 'FRAME', name: 'Header' })).toBe(false);
    expect(mod.isIconNode({ type: 'TEXT', name: 'icon label' })).toBe(false);
    expect(mod.isIconNode(null)).toBe(false);
  });
});

describe('collectDesign tree walk', () => {
  const tree = {
    id: '1:0',
    name: 'Screen',
    type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
    layoutMode: 'VERTICAL',
    itemSpacing: 16,
    paddingTop: 24,
    children: [
      {
        id: '1:1',
        name: 'Title',
        type: 'TEXT',
        characters: 'Welcome\nback',
        absoluteBoundingBox: { x: 20, y: 24, width: 200, height: 34 },
        style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 28, lineHeightPx: 34 },
        fills: [{ type: 'SOLID', color: { r: 0.066, g: 0.094, b: 0.153, a: 1 } }],
      },
      {
        id: '1:2',
        name: 'icon/search',
        type: 'INSTANCE',
        absoluteBoundingBox: { x: 331, y: 24, width: 24, height: 24 },
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
        children: [{ id: '1:3', name: 'path', type: 'VECTOR' }],
      },
    ],
  };

  it('extracts typography, icons, colors and does not descend into icons', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    const d = mod.collectDesign(tree);
    expect(d.typography).toHaveLength(1);
    expect(d.typography[0]).toMatchObject({ text: 'Welcome back', weight: 700, size: 28, x: 20, y: 24 });
    expect(d.icons).toHaveLength(1);
    expect(d.icons[0]).toMatchObject({ id: '1:2', name: 'icon/search', x: 331, y: 24, w: 24, h: 24 });
    expect(d.colors.length).toBeGreaterThan(0);
    expect(d.colors.some((c: { hex: string }) => c.hex === '#111827')).toBe(true);
  });

  it('respects the max node cap', async () => {
    const mod = await import('../templates/skills/figma/scripts/figma.mjs');
    const d = mod.collectDesign(tree, { max: 0 });
    expect(d.typography.length + d.icons.length).toBe(0);
  });
});
