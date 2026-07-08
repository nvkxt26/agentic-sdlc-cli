---
name: no-added-comments
description: "Deterministic guard that flags newly-added inline explanatory comments in a diff, while allowing doc/docblock comments that document a function/class/structure. Enforces the code-style rule. Runs standalone or as a code-reviewer check."
---

# no-added-comments skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; lowest reasoning needed.

Scans a git diff for **added** comment lines and classifies each as `doc` or `inline`. Enforces `{{INSTRUCTIONS_DIR}}/code-style.instructions.md`: no new **inline explanatory** comments unless the user explicitly asked — while allowing documentation comments (which SHOULD be updated when the structure they document changes).

## Classification
- **doc** (allowed, reported informationally) — JSDoc/docblock comments and their continuations: `/** ... */`, multi-line `/* ... */` banners, and interior `*` / `*/` lines. These document a function/class/structure; adding or updating them to match a changed structure is expected.
- **inline** (violation) — line-level explanations of the code below: `//`, single-line `/* ... */`, `#`, `<!-- -->`, and CSS `/* */`.
- Python/Ruby docstrings (`"""`/`'''`) are strings, not comments, so they are never flagged.

## What it does
- Selects the diff to scan: `--staged` (default), or `--range <expr>` (e.g. `main..HEAD`).
- Scans only known source extensions; skips docs/data (`.md`, `.toon`, `.json`, lockfiles, etc.).
- Tracks block-comment state so continuation lines of a doc block classify as `doc`.
- Exits non-zero only when an **inline** violation is found, unless `--warn-only` is passed.

## Inputs
- `--staged` (default) scan `git diff --cached`
- `--range <expr>` scan `git diff <expr>` instead
- `--warn-only` report but exit 0 (advisory mode)

## How to run
```bash
node {{SKILLS_DIR}}/no-added-comments/scripts/no-added-comments.mjs --staged
# or against a range:
agentic-workflow run no-added-comments -- --range main..HEAD
```

## Output (TOON)
```
noAddedComments:
  scope: staged
  scannedFiles: 3
  inlineViolationCount: 1
  docCommentCount: 2
inlineViolations[1]{file,line,text}:
  src/client.ts,42,// retry with backoff
docComments[2]{file,line,text}:
  src/client.ts,10,/** Retry the request with exponential backoff. */
  src/client.ts,11,* @param attempts max retries
```

Inline violations fail the gate (exit non-zero). Doc comments are surfaced so the reviewer can confirm they accurately reflect the changed structure, but do not fail the gate. On any failure it emits an `error:` TOON block and exits non-zero.
