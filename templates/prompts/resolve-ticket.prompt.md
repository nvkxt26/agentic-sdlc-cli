# Resolve a Jira ticket

Resolve a Jira ticket end-to-end using the SDLC persona workflow. Provide the **Jira ticket id** (e.g. `FXDOMAIN-1234`) as the argument; optionally a branch type (`feat|fix|release|chore`). Add `--no-toon` and/or `--no-caveman` to bypass the default TOON / caveman formatting for this run.

## Preconditions (check first — do not skip)
- The argument MUST be a **Jira ticket id** (e.g. `FXDOMAIN-1234`). If it is a freeform bug/feature description instead of a ticket id, **STOP** and ask the user for the ticket id. Do **not** treat the description as a direct coding task and do **not** edit source before the workflow starts.
- **Never skip mandatory steps.** Setup, Context, Product, Architect, and the Approval gate always run, in order, no matter how trivial the change appears. Only an explicit user instruction may skip a step.

## What to do
Act as the **SDLC Orchestrator** agent. Follow its rules exactly:

1. **Setup** — create `{{DOCS_DIR}}/<ticket>/`, then **confirm the base branch** before branching: detect the repo default (`origin/HEAD` → main/develop/master) and the current branch; ask the user whether the work should be based on that branch (do not assume — a hotfix may target a `release/*` branch). Create the branch from the confirmed base via the **git-branch** skill with `--base <name|default> --pull` (`<type>/<ticket>_<2-3 word desc>`).
2. **Context** — refresh codebase context via the **context-builder** agent (uses the **context-sync** skill with `--base <the confirmed base>`) → `{{CONTEXT_DIR}}/`. If context-sync reports `rebuildReason: base-branch-changed` or `context-not-ancestor-of-base` (cached context is ahead of / diverged from the base), do a full rebuild against the base before planning.
3. **Product** — gather requirements (Jira + Figma) → `requirements.toon`. Ask questions if anything is unclear; do not assume.
4. **Architect** — plan against `{{CONTEXT_DIR}}/` (reuse the **cache** skill), reusing existing project components/patterns → `plan.toon`.
4b. **Approval Gate** — STOP and ask the user to approve `plan.toon`. Do not edit source files before approval.
4c. **Optional Flowchart** — only if explicitly requested, invoke the **plan-flowchart** agent with `plan.toon` → `plan-flowchart.md`.
5. **Senior Developer** — only after approval, apply the plan as real implementation code → `dev-report.toon`; ensure the build passes.
6. **QA** — unit/integration tests → `qa-report.toon`.
7. **Code Reviewer** — review loop up to {{REVIEW_LOOPS}}x until clean → `review-log.toon`.
8. **Wrap** — commit via the **git-commit** skill (`[<ticket>]: <description>`) and summarize for the user in normal prose.

All inter-stage hand-offs default to **TOON** with **caveman FULL** — pass `--no-toon` to use plain Markdown and/or `--no-caveman` to use normal prose for this run instead. Persist every artifact under `{{DOCS_DIR}}/<ticket>/`. Reuse the **cache** skill for expensive fetches to save tokens (`{{INSTRUCTIONS_DIR}}/caching.instructions.md`). `{{CONTEXT_DIR}}/` and `{{CACHE_DIR}}/` are git-ignored.

Model-routing requirement: delegate each stage to its named persona subagent (do not inline persona work). For stage-related user Q/A, keep the same stage owner: generate questions via that persona subagent, relay user answers back to that same persona subagent, and only switch persona when the workflow stage changes.

If any required input is missing or ambiguous, STOP and ask numbered questions before proceeding.
