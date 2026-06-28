---
applyTo: '**'
description: All inter-skill communication uses TOON; caveman FULL is always active when emitting TOON.
---

# TOON communication

Every input and output exchanged **between skills/agents** in this workflow MUST be **TOON** (Token-Oriented Object Notation). This is non-negotiable for hand-offs (requirement #6).

## Why
TOON is line-oriented and indentation-based, and collapses arrays of uniform objects into a compact tabular form. It minimizes tokens while staying unambiguous.

## Rules
- When you produce a hand-off artifact (requirements, plan, dev/qa/review reports), emit **TOON**, not JSON/YAML/prose.
- **Caveman FULL is always on** while generating TOON values: drop articles, use fragments, short words, symbols (`→`, `=`). See `caveman.instructions.md`.
- Keep keys stable and machine-parseable. Technical terms stay exact.
- Persist each artifact under `{{DOCS_DIR}}/<JIRA>/` (see `workflow-docs.instructions.md`).
- Human-facing summaries (final wrap-up, questions to the user) are **normal prose**, not TOON.

## TOON quick reference
```
# scalar
ticket: FXDOMAIN-1234
# nested object
plan:
  summary: add retry to client
# array of primitives
labels[2]: backend,urgent
# array of uniform objects (tabular: header then rows)
steps[2]{order,file,change}:
  1,src/client.ts,add exponential backoff
  2,src/client.test.ts,cover retry path
```

Quote a scalar only if it contains spaces, commas, colons, or brackets.
