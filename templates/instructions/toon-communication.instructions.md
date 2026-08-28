# TOON communication

Inputs and outputs exchanged **between skills/agents** in this workflow default to **TOON** (Token-Oriented Object Notation) for hand-offs.

## Default on, bypass per run
TOON is the default for hand-offs. A prompt may be invoked with **`--no-toon`** to bypass it for that run — then emit hand-off artifacts as plain, readable **Markdown** instead. Honor the flag when the user passes it; otherwise use TOON.

## Why
TOON is line-oriented and indentation-based, and collapses arrays of uniform objects into a compact tabular form. It minimizes tokens while staying unambiguous.

## Rules
- When you produce a hand-off artifact (requirements, plan, dev/qa/review reports, cross-repo answers), emit **TOON** by default (or Markdown when `--no-toon` is set), not JSON/YAML/prose.
- **Caveman FULL is on by default** while generating TOON values: drop articles, use fragments, short words, symbols (`→`, `=`). Bypass with `--no-caveman`. See `{{INSTRUCTIONS_DIR}}/caveman.instructions.md`.
- Keep keys stable and machine-parseable. Technical terms stay exact.
- Persist each artifact under `{{DOCS_DIR}}/<JIRA>/` (see `{{INSTRUCTIONS_DIR}}/workflow-docs.instructions.md`).
- Human-facing summaries (final wrap-up, questions to the user, Mimir's answers to a human) are **normal prose**, not TOON.

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
