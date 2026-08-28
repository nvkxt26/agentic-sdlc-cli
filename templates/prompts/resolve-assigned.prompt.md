# Resolve assigned tickets (batch)

Resolve all tickets assigned to the current user from a Jira sprint, processing them sequentially through the full SDLC pipeline. Provide an optional **sprint id** (numeric) or `active` (default) as the argument.

## What to do
Act as the **Resolve-Assigned** agent. Follow its rules exactly.

1. **Fetch sprint tickets** via the **jira** skill:
   ```bash
   agentic-sdlc run jira -- --sprint <id|active>
   ```
   This returns a `tickets[]` TOON block sorted by priority DESC, created ASC.

2. **Safety confirmation** — if the result contains >10 tickets, STOP and ask the user for explicit confirmation before proceeding ("Found N tickets; proceed with batch resolution?"). Do not process large batches without user approval.

3. **Sequential processing** — for each ticket in order:
   - Create `{{DOCS_DIR}}/<ticket>/`.
   - Confirm the base branch (same as resolve-ticket: detect repo default, confirm with user, branch from base via git-branch `--base <name|default> --pull`).
   - **Optional: mark ticket In Progress** — ask the user whether to move this ticket to **In Progress** (confirm the status name if the project differs). If approved, transition via the **jira** skill (`agentic-sdlc run jira -- --issue <ticket> --transition "In Progress"`, single/multi hop; preview with `--list-transitions`). If declined, skip. Never change status without explicit approval; a transition failure is non-fatal — report and continue.
   - Refresh codebase context via **context-builder** (context-sync with `--base <the confirmed base>`; rebuild if context-not-ancestor-of-base).
   - Gather requirements via **product** → `requirements.toon`.
   - Plan via **architect** against `{{CONTEXT_DIR}}/` (reuse cache) → `plan.toon`.
   - **Per-ticket approval gate** — STOP and ask the user to approve `plan.toon` before continuing. Do not edit source without approval. If declined, record the ticket as skipped/failed and STOP the batch (fail-fast).
   - Apply plan via **senior-developer** as real implementation code → `dev-report.toon`; ensure build passes.
   - Add tests via **qa** → `qa-report.toon`.
   - Review via **code-reviewer** (up to {{REVIEW_LOOPS}}x) → `review-log.toon`. If review is unclean after {{REVIEW_LOOPS}} loops, record the ticket as failed and STOP the batch (fail-fast).
   - Commit via **git-commit** (`[<ticket>]: <description>`).
   - Continue to the next ticket.

4. **Fail-fast** — on the first ticket failure (approval declined, build failure, review unclean after {{REVIEW_LOOPS}} loops), STOP the batch immediately and report the failed ticket key + reason. Do not continue processing remaining tickets.

5. **Branch strategy** — one branch per ticket (standard git-branch behavior: `<feat|fix|release|chore>/<ticket>_<2-3 word desc>`). No umbrella branch, no auto-push, no PR creation.

6. **Emit batch-report.toon** and persist it at `{{DOCS_DIR}}/batch-report.toon`:
   ```
   batch:
     sprint: <id|active>
     totalTickets: N
     resolved: K
     failed: M
     skipped: L
   resolved[K]{ticket,branch,commit}:
     ...
   failed[M]{ticket,reason,stage}:
     ...
   ```

## Hard rules (apply to every ticket)
- **Never assume.** If context is missing, STOP and ask numbered questions. (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`)
- **TOON + caveman by default** — pass `--no-toon` / `--no-caveman` to bypass per run. (`{{INSTRUCTIONS_DIR}}/toon-communication.instructions.md`, `{{INSTRUCTIONS_DIR}}/caveman.instructions.md`)
- **Git conventions** (branch, commit). (`{{INSTRUCTIONS_DIR}}/git-conventions.instructions.md`)
- **Cache + context** reuse. (`{{INSTRUCTIONS_DIR}}/caching.instructions.md`)
- **Reuse project conventions** from codebase context. (`{{INSTRUCTIONS_DIR}}/project-conventions.instructions.md`)
- **Approval gate per ticket** — mandatory; never skip.
- **Delegate to persona subagents** — do not inline persona work; invoke each stage via its named subagent (context-builder, product, architect, senior-developer, qa, code-reviewer).

If the sprint query returns zero tickets, report that and stop gracefully.
