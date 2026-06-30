---
name: context-sync
description: Detect the repo's default branch (main/develop/master) and emit the file diff since the last indexed context commit (full list on first run). Tracks the indexed-commit marker. Runs standalone or as the setup step that feeds the context-builder agent.
---

# context-sync skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; lowest reasoning needed.

Deterministic git helper that tells the **context-builder** agent *what changed* so it only re-reads the delta instead of the whole tree.

## What it does
- Detects the default branch via `origin/HEAD`, falling back to `main` → `develop` → `master`.
- Reads the last indexed commit from `{{CONTEXT_DIR}}/context-meta.json`.
- **First run** (no marker) → `mode: full`, lists every tracked file.
- **Subsequent runs** → `mode: incremental`, lists `git diff --name-status <lastCommit>..<headCommit>`.
- `mode: noop` when already up to date.
- `--mark` records the current default-branch HEAD as the new indexed commit.

## Inputs
- `--context-dir <dir>` (default `{{CONTEXT_DIR}}`)
- `--branch <name>` (override default-branch detection)
- `--mark` (record HEAD as indexed commit — call AFTER context docs are written)

## How to run
```bash
# 1. plan: what changed since last context build?
node .github/skills/context-sync/scripts/context-sync.mjs --context-dir {{CONTEXT_DIR}}
# or:
agentic-workflow run context-sync -- --context-dir {{CONTEXT_DIR}}

# 2. after the context-builder agent updates the docs, advance the marker:
agentic-workflow run context-sync -- --mark --context-dir {{CONTEXT_DIR}}
```

## Output (TOON)
```
contextSync:
  branch: main
  mode: incremental
  lastCommit: abc1234
  headCommit: def5678
  contextDir: {{CONTEXT_DIR}}
  changeCount: 2
changes[2]{status,file}:
  M,src/client.ts
  A,src/retry.ts
```

`{{CONTEXT_DIR}}/` is git-ignored — context is local, regenerable state. On any failure the script emits an `error:` TOON block and exits non-zero. Do not guess the default branch — pass `--branch` if detection is wrong.
