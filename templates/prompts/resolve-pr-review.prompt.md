# Resolve pull request review comments

Evaluate the review comments on a pull request, distinguish valid findings from incorrect or non-actionable suggestions, and fix the confirmed genuine issues in the local checkout. Provide a **PR link or PR number** (e.g. `https://github.com/org/repo/pull/42` or `#42`) as the argument.

## Preconditions (check first — do not skip)
- The argument MUST resolve to a PR link or number. If it is anything else, STOP and ask for the PR.
- Use only the **`gh` CLI** (and `git` CLI) for GitHub and repository access — never GitKraken/other MCP git tools (`{{INSTRUCTIONS_DIR}}/git-conventions.instructions.md`).
- Run `gh auth status`, verify a GitHub remote, and require a clean working tree. STOP before edits if any precondition fails.
- Do not push, post review comments, dismiss comments, or commit changes. Those actions require separate explicit user approval after the local fix is reviewed.

## What to do

1. Fetch PR metadata, reviews, review comments, issue comments, changed files, and the diff with `gh`. Record the PR URL, title, body, source/base branches, and comment authors.
2. Extract a Jira ticket from the PR description, branch name, or title when one exists. If found, reuse the ticket's cached requirements and `{{CONTEXT_DIR}}/`; if not found, use the PR description, diff, surrounding code, and repository conventions as the available contract. Do not invent missing requirements.
3. Understand the PR implementation before judging comments. Read the changed code and the relevant callers, tests, and configuration. Refresh context against the PR base branch when context is stale.
4. Triage **every** review comment independently:
   - `actionable` — valid defect, regression, missing edge case, security issue, or standards violation supported by the current code and contract.
   - `not-actionable` — incorrect, already resolved, duplicate, preference-only, or unsupported by the contract.
   - `needs-human` — insufficient context or a product/design decision that cannot be resolved from the repository.
   Capture the exact comment, file/line when available, classification, evidence, and proposed response. Do not treat reviewer authority as proof of validity.
5. Report the triage in `{{DOCS_DIR}}/<ticket-or-PR-number>/pr-comment-resolution.toon`, then STOP and ask the user to confirm which `actionable` findings may be fixed. Keep `not-actionable` and `needs-human` items unchanged unless the user directs otherwise.
6. After confirmation, fix only the approved actionable findings and any directly required code-standard issues. Preserve the PR's intended behavior and avoid unrelated refactoring.
7. Add or update focused tests for each fix, then run the repository's build and relevant test commands. Report failures without hiding or weakening them.
8. Update the artifact with changed files, test/build evidence, unresolved items, and a suggested reply for each review comment. Do not post replies or a PR review.

## Output (TOON, caveman FULL)

Write to `{{DOCS_DIR}}/<ticket-or-PR-number>/pr-comment-resolution.toon` and return the same TOON. Use the PR number as the folder key when no Jira ticket is available.

```toon
review:
  pr: <number>
  ticket: <Jira id|none>
  status: triaged|awaiting-confirmation|fixed|needs-human
comments[N]{id,author,file,line,class,issue,evidence,action}:
  ...
changes[M]{file,issue,fix,test}:
  ...
validation:
  build: pass|fail|not-run
  tests: pass|fail|not-run
openQuestions[K]:
  - ...
```

All inter-stage hand-offs are **TOON** with **caveman FULL** active (`{{INSTRUCTIONS_DIR}}/toon-communication.instructions.md`, `{{INSTRUCTIONS_DIR}}/caveman.instructions.md`). Human-facing summaries are normal prose. If intent is genuinely ambiguous, STOP and ask numbered questions rather than guessing (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`).