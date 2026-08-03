# Consolidate Dependabot PRs

Consolidate all **OPEN** Dependabot PRs into a single PR and resolve dependency vulnerabilities. Optional argument: `--level patch|minor|all` (default `all`).

## Preconditions (check first — do not skip)
- **gh CLI authenticated** — run `gh auth status` before starting.
- **Clean git working tree** — run `git status` to verify. Commit or stash uncommitted changes before continuing.
- **GitHub remote** — verify the repo has a GitHub remote (`git remote -v`).
- **No-op idempotency** — if zero OPEN Dependabot PRs are found, report and exit gracefully (no-op). Do not fail.
- **Never skip discovery, base-branch selection, build, or test steps** — these are mandatory even when the change appears trivial.

## What to do
Act as the **Dependabot Consolidator** agent. Follow its rules exactly:

1. **Discover OPEN Dependabot PRs** — list all open PRs authored by `app/dependabot` OR labeled `dependencies` via `gh pr list`.
2. **Guard** — if zero PRs found, report and exit (idempotent no-op).
3. **Level filter** (optional) — apply `--level` filter to drop PRs above the specified semver level (patch|minor|all default all).
4. **Extract version bumps** — for each PR, read the dependency name and target version from the `package.json` diff via `gh pr diff <number> -- package.json`; fallback to parsing PR title regex `[Bb]ump (\S+) from (\S+) to (\S+)`.
5. **Base branch + pull** — detect repo default (`origin/HEAD` → `main` → `develop` → `master`); create ticket branch `feat/NVKXT26-00020_consolidate-deps` from default via the **git-branch** skill with `--base default --pull`.
6. **Apply version bumps** — rewrite matching dependency versions in `package.json` on the ticket branch. **Skip** any bump where the current version is already ≥ target (inline semver compare: split on `.`, numeric compare major/minor/patch, strip range prefixes `^`, `~`, `>=` and pre-release/build suffix).
7. **npm install** — regenerate `package-lock.json`.
8. **npm audit fix** — attempt to resolve vulnerabilities.
9. **npm audit --json** — capture remaining vulnerabilities; report but do **not** fail.
10. **npm run build** — capture pass/fail; report but do **not** block on failure.
11. **npm test** — capture pass/fail; report but do **not** block on failure.
12. **Commit + PR** — commit via the **git-commit** skill; push the branch; create consolidated PR to default branch via `gh pr create` (title/body per requirements).
13. **Close original PRs** — close each processed Dependabot PR via `gh pr close` with a comment linking to the consolidated PR.
14. **Leave ticket branch** — the ticket branch remains as the PR head; do not delete it.

Consolidated PR format:
- **Title**: `[NVKXT26-00020]: consolidate dependabot dependency updates`
- **Body**: table of dependency bumps (name, old→new), list of closed PRs with links, audit summary (before/after counts, remaining advisories), build/test results (pass/fail), ticket link.

All stage outputs are **TOON** with **caveman FULL** active. Persist artifacts (audit summary, processed/skipped PR list) under `{{DOCS_DIR}}/NVKXT26-00020/`.

If any required input is missing or ambiguous, STOP and ask numbered questions before proceeding (see `{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`).
