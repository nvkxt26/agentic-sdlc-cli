# Agentic SDLC Workflow

This project uses the **agentic-workflow** system. The rules below apply to every Copilot interaction.

## Personas

Six agents are installed in `.github/agents/`. Select the appropriate persona from the Copilot Chat agent picker, or use the SDLC Orchestrator to run the full pipeline:

| Agent | Role |
|---|---|
| SDLC Orchestrator | Start here — sequences the full ticket-resolution pipeline |
| Product Owner | Gathers requirements from Jira, Confluence, and Figma |
| Architect | Turns requirements into a concrete implementation plan |
| Senior Developer | Applies the plan (inline comments or real code) |
| QA | Adds and updates unit and integration tests |
| Code Reviewer | Review loop (up to {{REVIEW_LOOPS}}×) until the PR is clean |

Start with the `/resolve-ticket` prompt.

## Always-on rules

- **No assumptions** — if context is missing, stop and ask numbered questions before proceeding. See `.github/instructions/no-assume.instructions.md`.
- **TOON + caveman FULL** — all inter-agent hand-offs use TOON notation with caveman FULL compression. See `.github/instructions/toon-communication.instructions.md` and `.github/instructions/caveman.instructions.md`.
- **Git conventions** — branch names and commit messages follow a fixed pattern. See `.github/instructions/git-conventions.instructions.md`.
- **Per-ticket docs** — create `{{DOCS_DIR}}/<JIRA>/` for every ticket. See `.github/instructions/workflow-docs.instructions.md`.
- **Output mode** — default developer output is `{{DEFAULT_OUTPUT_MODE}}`. See `.github/instructions/output-mode.instructions.md`.
