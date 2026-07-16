---
name: toon-to-md
description: "Deterministically render a caveman-FULL TOON artifact (requirements/plan/dev-report/qa-report/review-log) into a readable Markdown document. Pure 1:1 structural transform — scalars, nested objects, primitive arrays, and tabular arrays become headings, lists, and Markdown tables. Does NOT de-caveman fragments into prose (that needs an agent). Runs standalone or in-workflow."
---

# toon-to-md skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; no reasoning needed.

Layer-1 structural renderer that turns a TOON hand-off artifact into human-readable Markdown. TOON is intentionally lossy caveman compression; this skill faithfully renders **structure**, it does not reconstruct prose. If you need caveman fragments expanded into natural sentences (external/non-technical audience), run an agent pass over the output.

## Grammar mapping (deterministic)
| TOON | Markdown |
|---|---|
| `k: v` scalar | `- **K:** v` |
| nested object | heading + nested render |
| `k[N]: a,b,c` inline primitive array | bullet list |
| `k[N]:` + `- item` block array | bullet list |
| `k[N]{f1,f2}:` + comma rows | aligned Markdown table **or** per-row sections (see layout) |
| `k[0]:` empty array | `_none_` |

### Table layout (`--layout`)
Tabular arrays render one of two ways so the raw Markdown stays readable:
- **aligned table** — every cell padded to its column width so columns line up in plain text.
- **sections** — one sub-heading per row (first column as the row label) with `- **Column:** value` bullets. Better when a row carries long free text (e.g. a `change` description).

`--layout` values:
- `auto` (default) — aligned table when the whole table fits (row ≤ 120 chars, no cell > 60 chars); otherwise sections.
- `table` — always aligned tables.
- `sections` — always per-row sections.

A single top-level object wrapper (e.g. `plan:`) is unwrapped into an `##` section for a cleaner document. A declared `[N]` count that disagrees with the actual rows is ignored (lenient).

## Inputs
- `--file <path>` (alias `--in <path>`) — TOON file to render. If omitted, reads TOON from **stdin**.
- `--out <path>` — write Markdown to a file and print a TOON status block. If omitted, Markdown is written to **stdout** (pipe-friendly).
- `--title <text>` — H1 title. Defaults to the title-cased file name.
- `--layout <auto|table|sections>` — how tabular arrays render (default `auto`).
- `--prose-extract` — emit caveman leaf fragments + protected tokens as TOON (Phase 1) and stop.
- `--prose-apply <rewrites.toon>` (alias `--map`) — apply light-model rewrites with a token-preservation guard, then render (Phase 3).

## How to run
```bash
# render a plan artifact to a sibling .md file
agentic-sdlc run toon-to-md -- --file docs/tickets/NVKXT26-0009/plan.toon --out docs/tickets/NVKXT26-0009/plan.md

# quick preview to stdout
agentic-sdlc run toon-to-md -- --file docs/tickets/NVKXT26-0009/requirements.toon

# via a pipe
cat docs/tickets/NVKXT26-0009/qa-report.toon | agentic-sdlc run toon-to-md --
```

## Optional prose enhancement (Layer 2, light-tier model)
Layer 1 renders structure faithfully but keeps caveman fragments (`add backoff → client`). For an external/non-technical audience you can de-caveman the leaf text into plain sentences. This is **model work**, so it is split into two deterministic script phases with a **light-tier model** step in between. The script never calls a model; the agent does.

**Phase 1 — extract** the fragments and their protected tokens:
```bash
agentic-sdlc run toon-to-md -- --file docs/tickets/NVKXT26-0009/requirements.toon --prose-extract
```
Emits:
```
proseExtract:
  source: docs/tickets/NVKXT26-0009/requirements.toon
  count: 13
  note: rewrite each text to one plain-prose sentence; every token in protect MUST appear verbatim; add no information
tasks[13]{id,protect,text}:
  L4,REQ-1|MANDATORY|autoApprove,"REQ-1: context-builder + cache-updater MANDATORY step; …"
```

**Phase 2 — rewrite (agent, light tier `{{TIER}}`):** for each task, rewrite `text` into one plain sentence. Every token listed in `protect` (identifiers, paths, `REQ-*`, `key:value`, generics) MUST appear verbatim; add no new information. Produce a rewrites file:
```
rewrites[N]{id,text}:
  L4,"REQ-1: the context-builder and cache-updater step is MANDATORY; skip it only when the user opts out via --skip-context or the autoApprove config."
```

**Phase 3 — apply** with a deterministic token-preservation guard:
```bash
agentic-sdlc run toon-to-md -- --file docs/tickets/NVKXT26-0009/requirements.toon \
  --prose-apply rewrites.toon --out docs/tickets/NVKXT26-0009/requirements.md
```
Any rewrite that drops a protected token is **reverted to the original fragment** (never silently corrupted). The status block reports `proseApplied` / `proseReverted`.

> Prose is opt-in and non-deterministic (a model runs in Phase 2). The default render stays deterministic and model-free.

## Output
- Without `--out`: the Markdown document on stdout.
- With `--out`: the file is written and a TOON status block is printed:
```
toonToMd:
  action: render
  out: docs/tickets/NVKXT26-0009/plan.md
  bytes: 2480
  title: Plan
```
Failures emit an `error:` TOON block and exit non-zero.
