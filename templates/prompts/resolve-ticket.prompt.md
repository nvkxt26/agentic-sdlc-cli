---
mode: agent
description: Kick off full SDLC resolution for a Jira ticket through the orchestrator.
model: {{MODEL}}
tools: ['codebase', 'search', 'editFiles', 'runCommands', 'runTasks', 'fetch', 'usages', 'changes', 'findTestFiles', 'todos', 'runSubagent']
---

# /resolve-ticket

Resolve a Jira ticket end-to-end using the SDLC persona workflow.

## Usage
Provide the Jira ticket id (and optional overrides):
- `${input:ticket:Jira ticket id e.g. FXDOMAIN-1234}`
- Optional: output mode (`comments` default | `code`), branch type (`feat|fix|release|chore`).

## What to do
Act as the **SDLC Orchestrator** (`.github/agents/sdlc-orchestrator.agent.md`). Follow its rules exactly:

1. **Setup** — create `{{DOCS_DIR}}/${input:ticket}/` and a branch via the **git-branch** skill (`<type>/<ticket>_<2-3 word desc>`).
2. **Product** — gather requirements (Jira + Figma) → `requirements.toon`. Ask questions if anything is unclear; do not assume.
3. **Architect** — implementation plan → `plan.toon`.
4. **Senior Developer** — apply plan in `{{DEFAULT_OUTPUT_MODE}}` mode → `dev-report.toon`; ensure build passes in `code` mode.
5. **QA** — unit/integration tests → `qa-report.toon`.
6. **Code Reviewer** — review loop up to {{REVIEW_LOOPS}}x until clean → `review-log.toon`.
7. **Wrap** — commit via the **git-commit** skill (`[${input:ticket}]: <description>`) and summarize for the user in normal prose.

All inter-stage hand-offs are **TOON** with **caveman FULL** active. Persist every artifact under `{{DOCS_DIR}}/${input:ticket}/`.

If any required input is missing or ambiguous, STOP and ask numbered questions before proceeding.
