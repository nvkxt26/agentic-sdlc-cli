# Plan an epic across repos

Plan the execution of a whole Jira **epic** across the repos in this workspace. Provide the **epic key** (e.g. `FXDOMAIN-1000`) as the argument.

## What to do
Act as the **Epic Planner** agent:

1. **Fetch the epic + children**: `agentic-sdlc run jira -- --epic <epic>`.
2. **List repos + context**: `agentic-sdlc run repo-bridge -- list`.
3. **Route each child ticket to its repo(s)** by matching intent against each repo's published context; when unclear, ask the repo's **Mimir** agent via `repo-bridge -- ask` / `repo-bridge -- answers`. A ticket may span multiple repos — split it into per-repo work items.
4. **Sequence** tickets by cross-repo dependencies (e.g. producer before consumer).
5. **Emit** `{{DOCS_DIR}}/<epic>/epic-plan.toon` (TOON, caveman FULL by default; pass `--no-toon` / `--no-caveman` to override) with a per-ticket, per-repo, ordered plan.

Each `(ticket, repo)` item is then independently resolvable with **/resolve-ticket** inside the target repo. Never assume repo ownership — determine it from evidence. (`{{INSTRUCTIONS_DIR}}/workspace.instructions.md`, `{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`)
