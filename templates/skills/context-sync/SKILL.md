---
name: context-sync
description: "Detect the repo's default branch (main/develop/master) and emit the file diff since the last indexed context commit (full list on first run). Tracks the indexed-commit marker. Runs standalone or as the setup step that feeds the context-builder agent."
---

# context-sync skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; lowest reasoning needed.

Deterministic git helper that tells the **context-builder** agent *what changed* so it only re-reads the delta instead of the whole tree.

## What it does
- Detects the default branch via `origin/HEAD`, falling back to `main` → `develop` → `master`. Override with `--branch` or `--base` (a work base other than the default, e.g. a release branch for a hotfix).
- Reads the last indexed commit **and base branch** from `{{CONTEXT_DIR}}/context-meta.json`.
- **First run** (no marker) → `mode: full`, lists every tracked file.
- **Subsequent runs** → `mode: incremental`, lists `git diff --name-status <lastCommit>..<headCommit>`.
- `mode: noop` when already up to date.
- **Base-branch changed** → if the recorded base (`meta.branch`) differs from the requested base, forces `mode: full` and reports `rebuildReason: base-branch-changed` (with `previousBranch`). Prevents reusing a delta computed against a different base.
- **Context ahead of base** → if the recorded commit is **not an ancestor** of the base HEAD (e.g. context built on `main` but work base is a `release/*` hotfix behind main), forces `mode: full` and reports `rebuildReason: context-not-ancestor-of-base`.
- **Self-heal** → if the marker exists but the context docs (`overview.toon`, `modules.toon`, `glossary.toon`) are missing, forces `mode: full` and reports `rebuildReason: context-docs-missing`. The marker alone is never treated as proof context exists.
- `--mark` records the current default-branch HEAD as the new indexed commit. It **refuses to stamp** (errors) when the required docs are absent — preventing a “poisoned marker” that skips the real build. Override with `--force` only if you know what you are doing.

## Inputs
- `--context-dir <dir>` (default `{{CONTEXT_DIR}}`)
- `--branch <name>` (override default-branch detection)
- `--base <name|default>` (tie context to a work base other than the default; `default` re-detects the repo default)
- `--mark` (record HEAD **and base branch** as indexed commit — call AFTER context docs are written; refuses if docs missing)
- `--force` (with `--mark`, stamp even if docs are missing — escape hatch, discouraged)

## How to run
```bash
# 1. plan: what changed since last context build?
node {{SKILLS_DIR}}/context-sync/scripts/context-sync.mjs --context-dir {{CONTEXT_DIR}}
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
