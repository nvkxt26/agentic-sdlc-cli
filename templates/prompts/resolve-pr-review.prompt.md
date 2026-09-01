# Resolve pull request review comments

Evaluate the review comments on a pull request, distinguish valid findings from incorrect or non-actionable suggestions, and fix the confirmed genuine issues in the local checkout. Provide a **PR link or PR number** (e.g. `https://github.com/org/repo/pull/42` or `#42`) as the argument.

## Preconditions (check first — do not skip)
- The argument MUST resolve to a PR link or number. If it is anything else, STOP and ask for the PR.
- Use only the **`gh` CLI** (and `git` CLI) for GitHub and repository access — never GitKraken/other MCP git tools (`{{INSTRUCTIONS_DIR}}/git-conventions.instructions.md`).
- Run `gh auth status`, verify a GitHub remote, and require a clean working tree. STOP before edits if any precondition fails.
- Default stance: do not push, post review comments, dismiss comments, or commit changes without approval. **EXCEPTION**: after separate explicit user approval, this workflow MAY push fix commits and mark review threads resolved. Resolution approval is requested **per-comment** — each thread requires individual user confirmation before marking resolved.

## What to do

1. Fetch PR metadata, reviews, changed files, and the diff with `gh`. Retrieve review **threads** with resolution state via `gh api graphql` (query `pullRequest { reviewThreads { nodes { id, isResolved, isOutdated, comments { nodes { id, databaseId, author { login }, path, line, body } } } } }`). Record the PR URL, title, body, source/base branches, comment authors, and **threadId** per comment. Note: REST review comments do not expose `isResolved` reliably; use graphql.
2. **Filter threads**: drop threads where `isResolved` is true. Triage only unresolved threads. Resolved threads are excluded from the `comments[]` table and from all subsequent steps.
3. Extract a Jira ticket from the PR description, branch name, or title when one exists. If found, reuse the ticket's cached requirements and `{{CONTEXT_DIR}}/`; if not found, use the PR description, diff, surrounding code, and repository conventions as the available contract. Do not invent missing requirements.
4. Understand the PR implementation before judging comments. Read the changed code and the relevant callers, tests, and configuration. Refresh context against the PR base branch when context is stale.
5. Triage **every** unresolved review comment independently, carrying the **threadId** into triage records for later resolution:
   - `actionable` — valid defect, regression, missing edge case, security issue, or standards violation supported by the current code and contract.
   - `not-actionable` — incorrect, already resolved, duplicate, preference-only, or unsupported by the contract.
   - `needs-human` — insufficient context or a product/design decision that cannot be resolved from the repository.
   Capture the exact comment, file/line when available, classification, evidence, proposed response, and threadId. Do not treat reviewer authority as proof of validity.
6. Report the triage in `{{DOCS_DIR}}/<ticket-or-PR-number>/pr-comment-resolution.toon`, then STOP and ask the user to confirm which `actionable` findings may be fixed. Keep `not-actionable` and `needs-human` items unchanged unless the user directs otherwise.
7. After confirmation, fix only the approved actionable findings and any directly required code-standard issues. Preserve the PR's intended behavior and avoid unrelated refactoring.
8. Add or update focused tests for each fix, then run the repository's build and relevant test commands. Report failures without hiding or weakening them.
9. Update the artifact with changed files, test/build evidence, unresolved items, and a suggested reply for each review comment. During this reporting phase, do not post replies or submit a PR review — thread replies and resolution happen only later in the post-approval Resolution workflow, each gated on per-comment user approval.

## Resolution workflow (post-approval only)

After approved actionable fixes are applied and build/tests pass:

1. **Push fixes**: ask the user to approve pushing the fix commits. On approval, push using `git` CLI following `{{INSTRUCTIONS_DIR}}/git-conventions.instructions.md`.
2. **Mark threads resolved**: for each fixed comment, prompt the user **per-comment** to approve marking that thread resolved. On approval, call `gh api graphql` with the `resolveReviewThread` mutation (`mutation { resolveReviewThread(input: { threadId: "<id>" }) { thread { id } } }`). Record each approval and resolution call.
3. **Not-valid comment handling**: when the user confirms a comment is not valid, reply explaining why via `gh api graphql` with the `addPullRequestReviewThreadReply` mutation (`mutation { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: "<threadId>", body: "<explanation>" }) { comment { id } } }`). Then, per-comment approval required, call `resolveReviewThread` for that threadId. Reply may happen immediately even without a code push.
4. **Graceful failure**: if a graphql mutation fails (e.g., lacking permission to resolve threads), surface the error clearly. Do not hide or suppress mutation errors.
5. **Coding-standard updates (MANDATORY/STRICT)**: when a resolved comment relates to a coding standard, update the most-relevant `{{INSTRUCTIONS_DIR}}/*.instructions.md` file (fallback: `code-style.instructions.md`) so the issue does not recur. Record the instruction file and rule added in `standardsUpdated[]`. If the instruction edit may conflict with concurrent workflow changes, suggest a PR review for that instruction change.

## Output (TOON, caveman FULL)

Write to `{{DOCS_DIR}}/<ticket-or-PR-number>/pr-comment-resolution.toon` and return the same TOON. Use the PR number as the folder key when no Jira ticket is available.

```toon
review:
  pr: <number>
  ticket: <Jira id|none>
  status: triaged|awaiting-confirmation|fixed|resolved|needs-human
comments[N]{id,threadId,author,file,line,class,issue,evidence,action,resolved}:
  ...
changes[M]{file,issue,fix,test}:
  ...
resolutions[R]{threadId,decision,replyPosted,resolvedCall,approvedBy}:
  ...
standardsUpdated[S]{file,rule}:
  ...
validation:
  build: pass|fail|not-run
  tests: pass|fail|not-run
  pushed: yes|no|not-approved
openQuestions[K]:
  - ...
```

All inter-stage hand-offs are **TOON** with **caveman FULL** active (`{{INSTRUCTIONS_DIR}}/toon-communication.instructions.md`, `{{INSTRUCTIONS_DIR}}/caveman.instructions.md`). Human-facing summaries are normal prose. If intent is genuinely ambiguous, STOP and ask numbered questions rather than guessing (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`).