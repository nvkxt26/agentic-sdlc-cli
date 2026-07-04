# Caching & context reuse

Goal: **fetch once, reuse everywhere.** Avoid re-fetching or re-reasoning over data the workflow already has. This directly cuts token usage.

## Store
- SQLite cache via the **cache** skill (`{{SKILLS_DIR}}/cache/`), backed by Node's built-in `node:sqlite`.
- DB lives at `{{CACHE_DIR}}/cache.db`. Codebase context lives at `{{CONTEXT_DIR}}/`.
- Both are **git-ignored** — local, regenerable state, never committed.

## Policy (every stage)
1. Before any expensive fetch or recompute, **check the cache first**:
   ```bash
   agentic-workflow run cache -- get --key <stable-key> --raw
   ```
2. On a **hit**, reuse the cached TOON. Do not re-fetch.
3. On a **miss**, do the work once, then **store** it:
   ```bash
   agentic-workflow run cache -- set --key <stable-key> --file <out.toon> --ttl <seconds>
   ```

## Stable keys
- `jira:<KEY>` · `epic:<KEY>` · `confluence:<id>` · `figma:<nodeId>` · `context:<commit>` · `plan:<JIRA>`
- Key on the inputs that determine the result. Tie code context to a commit sha so stale entries are never reused after the branch moves.

## TTLs (suggested)
- Jira/Confluence/Figma fetches: `--ttl 86400` (1 day).
- Codebase context (`context:<commit>`): no TTL (`--ttl 0`) — invalidated by the commit key changing.
- Run `cache -- prune --max-age <seconds>` periodically to drop stale rows.

## Plan against context
The **architect** MUST read generated context from `{{CONTEXT_DIR}}/` (refreshed by the **context-builder** agent + **context-sync** skill) before producing `plan.toon`, and reuse the cached `context:<commit>` entry instead of re-reading the tree. If context is missing or stale, refresh it first.
