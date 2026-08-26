---
name: figma
description: "Fetch Figma node metadata and rendered images from a Figma design link, optionally saving the images locally, and emit a TOON summary. Use when a Jira ticket references Figma designs so visual changes can be identified."
---

# figma skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic fetch; the model identifies visual changes from the returned images.

## Inputs
- `--url <figma link>`  (preferred; node id parsed from `?node-id=`)
- or `--file <KEY> --node <NODE_ID>`
- optional `--out <dir>` to download PNGs + icon SVGs (e.g. `{{DOCS_DIR}}/<JIRA>/figma`)
- optional `--max <N>` cap on nodes walked (default 300)
- optional `--no-assets` to skip icon SVG export

## Required environment
- `FIGMA_API_TOKEN` — a Figma personal access token

## How to run
```bash
node {{SKILLS_DIR}}/figma/scripts/figma.mjs --url "https://www.figma.com/design/KEY/Name?node-id=12-34" --out docs/FXDOMAIN-1234/figma
# or:
agentic-sdlc run figma -- --url "<link>"
```

The script returns the rendered image **and** structured design tokens extracted from the node document tree, so the implementation has exact values instead of eyeballing a PNG. When `--out` is given it saves the PNG and each icon as an SVG. The model should still open the saved image to confirm intent.

## Output (TOON)
```
figma:
  fileKey: KEY
  node: 12:34
  name: Screen
  width: 375
  height: 812
nodes[1]{id,name,imageUrl,savedTo}:
  12:34,Screen,https://...,docs/.../12-34.png
frames[F]{id,name,type,x,y,w,h,layout,gap,padLeft,padTop,padRight,padBottom,radius,align,visible}:
  ...
typography[T]{id,name,text,font,weight,size,lineHeight,letterSpacing,case,align,color,x,y,w,h}:
  ...
colors[C]{hex,opacity,usage,count}:
  ...
icons[I]{id,name,type,x,y,w,h,svgUrl,savedTo}:
  ...
effects[E]{id,name,type,color,x,y,blur,spread}:
  ...
```

- `x,y` are positions **relative to the fetched frame** (px), `w,h` are sizes — use them to place sections correctly.
- `typography` carries `weight` (font weight), `size`, `lineHeight`, `letterSpacing`, `case`, `align`, and text `color` — the values most often dropped when working from an image alone.
- `frames` carries auto-layout (`layout`, `gap`, padding, `radius`, `align`) so containers are laid out, not guessed.
- `icons` lists vector/icon nodes with an `svgUrl` (and `savedTo` when `--out` is set) so existing icons are picked up and new ones created from the exported SVG.
- Structured blocks are omitted when empty.

On failure emits an `error:` TOON block and exits non-zero. Never assume design intent — if an image is ambiguous, ask the user.
