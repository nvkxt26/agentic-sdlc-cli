---
name: confluence
description: "Deterministically fetch a Confluence page (by id, or by title + space key) and emit its content as TOON. Use when a ticket references supporting documentation. Runs standalone or in-workflow."
---

# confluence skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic fetch; model only interprets results.

## Inputs
- `--id <pageId>`  **or**  `--title "<page title>" --space <SPACEKEY>`

## Required environment
- `ATLASSIAN_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`

## How to run
```bash
node {{SKILLS_DIR}}/confluence/scripts/confluence.mjs --id 123456
node {{SKILLS_DIR}}/confluence/scripts/confluence.mjs --title "Design doc" --space ENG
# or:
agentic-sdlc run confluence -- --id 123456
```

## Output (TOON)
```
page:
  id: 123456
  title: ...
  space: ENG
  version: 7
  url: ...
body: ...
```

On failure emits an `error:` TOON block and exits non-zero. Never assume missing fields.
