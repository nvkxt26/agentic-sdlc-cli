# Agentic SDLC Workflow

This project uses the **agentic-workflow** system (provider: {{PROVIDER}}). The rules below apply to every interaction.

## Agents

Installed in `{{AGENTS_DIR}}/`. Pick the appropriate persona, or use the SDLC Orchestrator to run the full pipeline:

| Agent | Role |
|---|---|
| SDLC Orchestrator | Start here — sequences the full ticket-resolution pipeline |
| Context Builder | Maintains codebase context on the default branch (incremental, diff-based) |
| Product Owner | Gathers requirements from Jira, Confluence, and Figma |
| Architect | Turns requirements into a concrete implementation plan |
| Plan Flowchart | Optionally turns plan.toon into a Mermaid implementation flowchart for human review |
| Senior Developer | Applies the plan (inline comments or real code) |
| QA | Adds and updates unit and integration tests |
| Code Reviewer | Review loop (up to {{REVIEW_LOOPS}}×) until the change is clean |
| Mimir | Answers any question about this repo; refreshes context first when stale |
| Epic Planner | Plans a whole Jira epic across a group of repos (workspace) |

Entry points: `/resolve-ticket` (one ticket), `/ask-repo` (a question), `/plan-epic` (an epic across repos).

## Always-on rules

- **No assumptions** — if context is missing, stop and ask numbered questions before proceeding. See `{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`.
- **TOON + caveman FULL** — all inter-agent hand-offs use TOON notation with caveman FULL compression. See `{{INSTRUCTIONS_DIR}}/toon-communication.instructions.md` and `{{INSTRUCTIONS_DIR}}/caveman.instructions.md`.
- **Git conventions** — branch names and commit messages follow a fixed pattern. See `{{INSTRUCTIONS_DIR}}/git-conventions.instructions.md`.
- **Per-ticket docs** — create `{{DOCS_DIR}}/<JIRA>/` for every ticket. See `{{INSTRUCTIONS_DIR}}/workflow-docs.instructions.md`.
- **Output mode** — default developer output is `{{DEFAULT_OUTPUT_MODE}}`. See `{{INSTRUCTIONS_DIR}}/output-mode.instructions.md`.
- **Reuse project conventions** — prefer existing components/utilities/patterns over generic ones. See `{{INSTRUCTIONS_DIR}}/project-conventions.instructions.md`.
- **Cache + context** — reuse fetched data via the cache skill and plan against generated context. See `{{INSTRUCTIONS_DIR}}/caching.instructions.md`. Generated state in `{{CONTEXT_DIR}}/`, `{{CACHE_DIR}}/` and `{{REGISTRY_DIR}}/` is git-ignored.
- **Workspaces** — when part of a repo group, coordinate via the shared registry and repo-bridge. See `{{INSTRUCTIONS_DIR}}/workspace.instructions.md`.
- **Delegate by name, never role-play a persona.** Each agent above is pinned to its own model tier for a reason (heavy reasoning vs. light glue work). That pin only applies when a coordinating agent (SDLC Orchestrator, Mimir) actually invokes the target persona through the subagent tool by its exact name — answering a persona's stage inline instead of delegating silently runs it on the wrong model.
