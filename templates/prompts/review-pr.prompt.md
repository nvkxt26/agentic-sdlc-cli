# Review a pull request

Critically review a pull request against the Jira ticket it implements. Provide a **PR link or PR number** (e.g. `https://github.com/org/repo/pull/42` or `#42`) as the argument.

Act as a **critical senior developer / architect**: your job is not to rubber-stamp. Compare the solution *you* would build for the requirements against what the PR actually does, and surface every gap in accuracy, efficiency, edge-case coverage, new bugs, and coding-standard violations.

## Preconditions (check first — do not skip)
- The argument MUST resolve to a **PR link or number**. If it is anything else (a ticket id, a freeform description), **STOP** and ask for the PR.
- Use only the **`gh` CLI** (and `git` CLI) for PR access — never GitKraken/other MCP git tools (`{{INSTRUCTIONS_DIR}}/git-conventions.instructions.md`).
- **Never edit source or push.** Do not post anything to the PR until the user explicitly confirms at the gate in step 9. Posting a PR review/comment is not reversible — treat the confirmation as mandatory.

## What to do

1. **Fetch PR metadata (not the diff yet).** `gh pr view <pr> --json number,title,body,headRefName,baseRefName,files,url`. Capture description, branch names, changed-file list, and URL. **Do not pull the diff yet** — the baseline design must be built blind so it isn't anchored to the PR's approach.
2. **Extract the Jira ticket.** Parse the ticket id from the PR description first, then fall back to the branch name (`<type>/<TICKET>_<desc>`) and PR title. If no ticket id can be found, **STOP** and ask the user for it — do not assume (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`).
3. **Refresh context.** Run `agentic-sdlc run context-sync -- --base <baseRefName> --context-dir {{CONTEXT_DIR}}`. If it reports `full`/`incremental` (or a rebuild reason), refresh via the **context-builder** agent before designing so the baseline reflects the real current tree, not a stale index.
4. **Gather requirements.** Delegate to the **Product Owner** subagent to fetch the ticket via the **jira** skill (`{{SKILLS_DIR}}/jira/`) → `{{DOCS_DIR}}/<ticket>/requirements.toon`. Reuse the **cache** skill for the fetch (`{{INSTRUCTIONS_DIR}}/caching.instructions.md`).
5. **Finalize acceptance criteria.** If requirements, scope, edge cases, or acceptance criteria are unclear, **STOP** and ask the user numbered questions. Do not review until acceptance criteria are agreed (a non-empty `openQuestions[]` pauses the flow).
6. **Design + persist the baseline plan (blind).** Delegate to the **Architect** subagent to produce the solution *you* would build for these requirements — key components, data flow, edge cases, complexity — planning against `{{CONTEXT_DIR}}/` so it reuses existing project patterns/components. **Persist it** to `{{DOCS_DIR}}/<ticket>/review-plan.toon` (TOON, caveman FULL). This is the independent, auditable baseline the PR is judged against — kept separate from any dev `plan.toon`. You still have not read the diff at this point.
7. **Review the PR against the baseline.** Now pull the diff: `gh pr diff <pr>`. Compare the diff to `review-plan.toon` and the acceptance criteria. Check for:
   - **Accuracy** — every acceptance criterion met; behavior matches intent.
   - **Efficiency** — algorithmic complexity, redundant work, unnecessary allocations/queries.
   - **Edge cases** — missing/untested boundaries, null/empty/error paths.
   - **New bugs / regressions** — logic errors, broken existing behavior, security issues (OWASP Top 10) at boundaries.
   - **Coding standards** — project conventions (`{{INSTRUCTIONS_DIR}}/project-conventions.instructions.md`, `{{INSTRUCTIONS_DIR}}/code-style.instructions.md`), no newly-added source comments unless requested (run the **no-added-comments** skill, `{{SKILLS_DIR}}/no-added-comments/`, over the diff).
8. **Report.** Emit the review artifact below and give the user a normal-prose summary with a clear verdict.
9. **User review + discussion.** Present the findings to the user and discuss. Incorporate their corrections — drop findings they reject, add ones they raise, adjust severity/verdict — and update `pr-review.toon` accordingly. Loop here until the user signals the discussion is concluded. Do not proceed while any point is still open.
10. **Confirmation gate → post or skip.** Once the discussion concludes, **STOP and ask the user to confirm** whether to post the review comments on the PR (yes/no).
   - **Yes** → post via the `gh` CLI: a summary review with `gh pr review <pr> --comment --body <summary>` (use `--request-changes` when verdict is `request-changes`), and per-finding line comments where applicable. Confirm back with the posted URL(s).
   - **No** → do not post anything; leave the artifact as the record and tell the user nothing was posted.
   Post only the findings agreed during step 9 — never post without an explicit yes.

## Output (TOON, caveman FULL)
Write to `{{DOCS_DIR}}/<ticket>/pr-review.toon` and return the same TOON. Shape:

```
review:
  pr: <number>
  ticket: FXDOMAIN-1234
  verdict: approve|request-changes|needs-human
acceptance[N]{criterion,met,evidence}:
  ...
findings[M]{file,line,severity,category,issue,fix}:
  ...
  # severity = blocking|major|minor|nit
  # category = accuracy|efficiency|edge-case|bug|standards|security
altApproach:
  - <where review-plan.toon differs from the PR and why it is better>
openQuestions[K]:
  - ...
```

All inter-stage hand-offs are **TOON** with **caveman FULL** active (`{{INSTRUCTIONS_DIR}}/toon-communication.instructions.md`, `{{INSTRUCTIONS_DIR}}/caveman.instructions.md`). Any unresolved item goes in `openQuestions[]` and pauses the review. The final user-facing summary is normal prose.
