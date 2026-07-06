---
name: graphify
description: "Optional knowledge-graph layer on top of the flat TOON codebase context. Wraps the external `graphify` CLI (graphifyy on PyPI) to build/refresh a queryable graph of the repo (code via tree-sitter, docs/PDFs/images via the assistant's model) and to query relationships, paths and explanations. Degrades gracefully (status: unavailable) when the `graphify` CLI isn't installed — context-builder and mimir fall back to the TOON docs in that case."
---

# graphify skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic wrapper; the model only orchestrates calls and interprets results.

Thin, best-effort bridge to the third-party [graphify](https://github.com/Graphify-Labs/graphify) CLI (`graphifyy` on PyPI). Graphify turns the repo into a queryable knowledge graph (`graphify-out/graph.json`) with richer cross-file relationships, god-nodes and surprising connections than the flat `overview.toon`/`modules.toon`/`glossary.toon` files this workflow writes by default. It is **optional and additive** — nothing in this workflow requires it, and every action fails soft with an `error:`/`available: false` TOON block instead of crashing when the CLI or graph is missing.

## Actions

```bash
# is the graphify CLI on PATH, and does graphify-out/graph.json already exist?
agentic-workflow run graphify -- status

# build or refresh the graph (code-only extraction is offline, no API key needed)
agentic-workflow run graphify -- build
agentic-workflow run graphify -- build --update   # only re-extract changed files

# ask a relationship/architecture question against the graph
agentic-workflow run graphify -- query "what connects auth to the database?"

# shortest relationship path between two named entities
agentic-workflow run graphify -- path "UserService" "DatabasePool"

# explain a single entity in context
agentic-workflow run graphify -- explain "RateLimiter"
```

## When to use it (context-builder / mimir)
1. Run `status` first. If `available: false`, stop using graphify for this run — the TOON context files remain the source of truth.
2. **context-builder**: after writing/updating `overview.toon`/`modules.toon`/`glossary.toon`, run `build --update` (cheap, offline for code) so the graph stays in sync with the same commit. Optionally pull god-nodes/surprising-connections out of `graphify-out/GRAPH_REPORT.md` to enrich `overview.toon`.
3. **mimir**: for questions about *relationships* ("what connects X to Y", "what would break if I change Z") prefer `query`/`path`/`explain` over re-reading files; for everything else, the TOON context is normally sufficient and cheaper.

## Output (TOON)

Unavailable (CLI missing):
```
graphify:
  action: status
  available: false
  reason: "graphify CLI not found on PATH"
  installHint: "uv tool install graphifyy && graphify install"
```

Available:
```
graphify:
  action: query
  available: true
  graphPath: graphify-out/graph.json
  question: "what connects auth to the database?"
result: |
  <raw graphify query output>
```

## Notes
- Installed/refreshed once, best-effort, during `agentic-workflow init` (or manually — see README). This wrapper never installs the `graphify` CLI itself; it only calls it.
- Code-only extraction (`build`) runs fully offline via tree-sitter — no API key required. Extending it to docs/PDFs/images uses the assistant's own model session and needs no extra key either when run via `/graphify` inside the IDE.
- `graphify-out/` is meant to be committed (it's a shared map for the whole team); only `graphify-out/cost.json` and the `.graphify_python` marker are git-ignored (added automatically during `init`).
- On any failure (CLI missing, no graph built yet, malformed args) the script emits an `error:`/`available: false` TOON block and exits non-zero — never guess at graph contents.
