---
name: repo-bridge
description: "Cross-repo context channel for a workspace (a folder grouping several repos). Publish this repo's generated context to a shared registry, read peer repos' context, and exchange questions/answers between repos' agents via a file mailbox. Use when an agent needs information from — or must coordinate with — a sibling repo."
---

# repo-bridge skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; the model only orchestrates calls and interprets results.

The channel that lets agents/skills in **different repos communicate about repo context**. It is paired with the **Mimir** agent: repo-bridge is the deterministic transport (publish/read/mailbox); mimir is the intelligence that answers.

Requires a workspace root (`.agentic-workspace.json`, created by `agentic-sdlc workspace init`). The shared registry lives at `<workspace>/{{REGISTRY_DIR}}/` (git-ignored).

## Actions

```bash
# publish THIS repo's context (overview/modules/glossary .toon + marker) to the registry
agentic-sdlc run repo-bridge -- publish

# list every published repo and its manifest
agentic-sdlc run repo-bridge -- list

# read a peer repo's published context (all, or one file)
agentic-sdlc run repo-bridge -- read --repo billing
agentic-sdlc run repo-bridge -- read --repo billing --file modules.toon

# scoped sub-query: only rows/lines matching <term> (+ their header), not the whole file
# use this instead of `read` whenever you only need a narrow fact — cuts tokens sharply
# on large published context
agentic-sdlc run repo-bridge -- query --repo billing --match invoice
agentic-sdlc run repo-bridge -- query --repo billing --match invoice --file modules.toon

# ask a peer repo a question (queued to its inbox); prints a question id
agentic-sdlc run repo-bridge -- ask --repo billing --question "does this repo own invoice PDF generation? which modules?"

# on the answering side: the mimir agent reads pending questions...
agentic-sdlc run repo-bridge -- inbox
# ...answers one (TOON body, caveman FULL)
agentic-sdlc run repo-bridge -- answer --id <id> --file answer.toon

# the asker collects the reply (searches all repos for the id)
agentic-sdlc run repo-bridge -- answers --id <id>
```

## Output (TOON)
```
repoBridge:
  action: list
  registry: /path/.agentic/registry
  count: 3
repos[3]{name,lastCommit,files,updatedAt}:
  billing,abc1234,3,2025-01-01T00:00:00Z
  ...
```

## Notes
- `answers` exits non-zero while a reply is still `pending`, so shell polling works.
- Keep context fresh: the **context-builder** agent runs `publish` after each refresh.
- On failure (no workspace, unknown repo/file) the script emits an `error:` TOON block and exits non-zero. Never assume a peer's internals — read published context or ask.
- Prefer `query` over `read` whenever you only need a narrow fact (does repo X own Y, which module handles Z). `query` does a case-insensitive substring match over each published `.toon` file's rows/lines and returns only the matches (plus their tabular header for context), instead of the whole file — this is the token-economic default. Fall back to `read` only when you genuinely need the full context (e.g. before writing a cross-repo plan).
