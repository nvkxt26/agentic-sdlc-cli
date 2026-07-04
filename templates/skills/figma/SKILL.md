---
name: figma
description: Fetch Figma node metadata and rendered images from a Figma design link, optionally saving the images locally, and emit a TOON summary. Use when a Jira ticket references Figma designs so visual changes can be identified.
---

# figma skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic fetch; the model identifies visual changes from the returned images.

## Inputs
- `--url <figma link>`  (preferred; node id parsed from `?node-id=`)
- or `--file <KEY> --node <NODE_ID>`
- optional `--out <dir>` to download PNGs (e.g. `{{DOCS_DIR}}/<JIRA>/figma`)

## Required environment
- `FIGMA_API_TOKEN` — a Figma personal access token

## How to run
```bash
node {{SKILLS_DIR}}/figma/scripts/figma.mjs --url "https://www.figma.com/design/KEY/Name?node-id=12-34" --out docs/FXDOMAIN-1234/figma
# or:
agentic-workflow run figma -- --url "<link>"
```

The script returns image URLs (and saves PNGs when `--out` is given). The model should then open the saved images to identify the required visual changes.

## Output (TOON)
```
figma:
  fileKey: KEY
nodes[N]{id,name,imageUrl,savedTo}:
  ...
```

On failure emits an `error:` TOON block and exits non-zero. Never assume design intent — if an image is ambiguous, ask the user.
