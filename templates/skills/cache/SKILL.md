---
name: cache
description: "SQLite-backed key/value cache (Node built-in node:sqlite) for context, Jira, Figma and other fetches. Check it before fetching/recomputing and store results after, so workflow stages reuse data instead of spending tokens. Runs standalone or in-workflow."
---

# cache skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; lowest reasoning needed.

A small SQLite store so the workflow **fetches once, reuses everywhere**. Backed by Node's built-in `node:sqlite` (Node >= 22) — no external dependency, works inside any target repo.

Store: `{{CACHE_DIR}}/cache.db` (git-ignored). Table `cache(scope, key, value, created_at, ttl)`.

## When to use (token-saving policy)
Before any expensive fetch or recompute (Jira issue, Figma node, Confluence page, codebase context, plan fragment): **get** by a stable key. On a hit, reuse the cached TOON. On a miss, do the work, then **set** it. See `caching.instructions.md`.

Suggested key shapes: `jira:<KEY>`, `figma:<nodeId>`, `context:<commit>`, `plan:<JIRA>`.

## Inputs
- `set --key <k> (--value <s> | --file <path>) [--scope <s>] [--ttl <seconds>]`
- `get --key <k> [--scope <s>] [--raw]`  (`--raw` prints the value verbatim; exit 1 on miss)
- `has --key <k> [--scope <s>]`  (exit 0 hit / 1 miss)
- `del --key <k> [--scope <s>]`
- `list [--scope <s>]`
- `prune [--max-age <seconds>]`  (always drops ttl-expired rows)
- global: `--cache-dir <dir>` (default `{{CACHE_DIR}}`), `--ttl 0` = never expires

## How to run
```bash
# miss → fetch → store
agentic-workflow run cache -- get --key jira:FXDOMAIN-1234 || \
  agentic-workflow run jira -- --issue FXDOMAIN-1234 > /tmp/jira.toon && \
  agentic-workflow run cache -- set --key jira:FXDOMAIN-1234 --file /tmp/jira.toon --ttl 86400

# reuse cached value verbatim
agentic-workflow run cache -- get --key jira:FXDOMAIN-1234 --raw
```

## Output (TOON)
```
cache:
  action: get
  scope: default
  key: jira:FXDOMAIN-1234
  hit: true
  ageSec: 42
  bytes: 1280
value: ...
```

On a miss `get`/`has` exit non-zero so shell `||` fallbacks work. Failures emit an `error:` TOON block.
