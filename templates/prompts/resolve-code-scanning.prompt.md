# Resolve code-scanning alerts

Triage all **OPEN** GitHub `security/code-scanning` alerts for a repo, list likely false positives for confirmation and dismissal, fix the real issues with code changes, and consolidate everything into a single PR. Optional argument: a code-scanning URL or `owner/repo`; if omitted, derive the repo from the current git remote.

## Preconditions (check first — do not skip)
- **gh CLI authenticated** — run `gh auth status` before starting.
- **Clean git working tree** — run `git status` to verify. Commit or stash uncommitted changes before continuing.
- **GitHub remote** — verify the repo has a GitHub remote (`git remote -v`).
- **Resolve target repo** — use the provided code-scanning URL or `owner/repo`; if absent, derive `owner/repo` from the current repo base URL.
- **Code-scanning only** — operate on GitHub `security/code-scanning` alerts only. Do not include Dependabot or secret-scanning alerts.
- **No-op idempotency** — if zero OPEN code-scanning alerts are found, report and exit gracefully (no-op). Do not fail.
- **Never skip discovery, triage, false-positive confirmation, base-branch selection, build, or test steps** — these are mandatory even when the changes appear small.

## What to do
Act as the **Code Scanning Remediator** agent. Follow its rules exactly:

1. **Resolve the target repo** — parse the optional code-scanning URL or `owner/repo`; if neither is provided, derive `owner/repo` from the current git remote origin.
2. **Discover OPEN code-scanning alerts** — list all open alerts via `gh api /repos/{owner}/{repo}/code-scanning/alerts?state=open --paginate`.
3. **Guard** — if zero alerts are found, report and exit (idempotent no-op).
4. **Triage every alert** — classify each alert as either a likely false positive or a real issue, capturing rule, severity, file, line, message, and reasoning.
5. **False-positive confirmation gate** — present every false-positive candidate to the user with details about why it is a false positive, then STOP and ask for confirmation before dismissing anything.
6. **Dismiss confirmed false positives** — only after confirmation, dismiss the approved false positives via `gh api` with `state=dismissed` and `dismissed_reason=false_positive`.
7. **Base branch + pull** — detect the repo default (`origin/HEAD` → `main` → `develop` → `master`); create ticket branch `feat/NVKXT26-00021_code-scanning-remediation` from default via the **git-branch** skill with `--base default --pull`.
8. **Fix the real alerts** — apply real code changes for every non-false-positive alert.
9. **Build** — run the repo build and capture pass/fail.
10. **Test** — run the repo tests and capture pass/fail.
11. **Commit** — commit via the **git-commit** skill.
12. **Push/PR confirmation gate** — STOP and ask the user to approve the consolidated change set before pushing the branch or opening a PR.
13. **Create one PR** — after approval, push the branch and open a single consolidated PR to the default branch via `gh pr create`.

Consolidated PR format:
- **Title**: `[NVKXT26-00021]: resolve code-scanning alerts`
- **Body**: fixed alerts summary, dismissed false-positive summary with reasons, build/test results, and ticket link.

All stage outputs are **TOON** with **caveman FULL** active. Persist artifacts (alert triage, dismissed false positives, fixed alerts) under `{{DOCS_DIR}}/NVKXT26-00021/`.

If any required input is missing or ambiguous, STOP and ask numbered questions before proceeding (see `{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`).