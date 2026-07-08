# Resolve a Jira ticket

Resolve a Jira ticket end-to-end using the SDLC persona workflow. Provide the **Jira ticket id** (e.g. `FXDOMAIN-1234`) as the argument; optionally an output mode (`comments` default | `code`) and branch type (`feat|fix|release|chore`).

## What to do
Act as the **SDLC Orchestrator** agent. Follow its rules exactly:

1. **Setup** — create `{{DOCS_DIR}}/<ticket>/` and a branch via the **git-branch** skill (`<type>/<ticket>_<2-3 word desc>`).
2. **Context** — refresh codebase context via the **context-builder** agent (uses the **context-sync** skill against the default branch) → `{{CONTEXT_DIR}}/`.
3. **Product** — gather requirements (Jira + Figma) → `requirements.toon`. Ask questions if anything is unclear; do not assume.
4. **Architect** — plan against `{{CONTEXT_DIR}}/` (reuse the **cache** skill), reusing existing project components/patterns → `plan.toon`.
4b. **Approval Gate** — STOP and ask the user to approve `plan.toon`. Do not edit source files before approval.
4c. **Optional Flowchart** — only if explicitly requested, invoke the **plan-flowchart** agent with `plan.toon` → `plan-flowchart.md`.
5. **Senior Developer** — only after approval, apply plan in `{{DEFAULT_OUTPUT_MODE}}` mode → `dev-report.toon`; ensure build passes in `code` mode.
6. **QA** — unit/integration tests → `qa-report.toon`.
7. **Code Reviewer** — review loop up to {{REVIEW_LOOPS}}x until clean → `review-log.toon`.
8. **Wrap** — commit via the **git-commit** skill (`[<ticket>]: <description>`) and summarize for the user in normal prose.

All inter-stage hand-offs are **TOON** with **caveman FULL** active. Persist every artifact under `{{DOCS_DIR}}/<ticket>/`. Reuse the **cache** skill for expensive fetches to save tokens (`{{INSTRUCTIONS_DIR}}/caching.instructions.md`). `{{CONTEXT_DIR}}/` and `{{CACHE_DIR}}/` are git-ignored.

Model-routing requirement: delegate each stage to its named persona subagent (do not inline persona work). For stage-related user Q/A, keep the same stage owner: generate questions via that persona subagent, relay user answers back to that same persona subagent, and only switch persona when the workflow stage changes.

If any required input is missing or ambiguous, STOP and ask numbered questions before proceeding.
