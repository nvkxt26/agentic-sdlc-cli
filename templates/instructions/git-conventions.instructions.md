# Git conventions

## Branch names
Pattern:
```
<feat|fix|release|chore>/<JIRA-TICKET>_<two-to-three word description>
```
- Type chosen from the ticket: feature → `feat`, bug → `fix`, release → `release`, maintenance → `chore`.
- Description: 2–3 words, lowercase, hyphen-separated.
- Example: `feat/FXDOMAIN-0000_implement-agentic-workflow-cli`

Use the **git-branch** skill (`{{SKILLS_DIR}}/git-branch/`) to create branches; it validates the pattern.

## Base-branch selection (mandatory at workflow start)
Before creating a ticket branch, establish the correct **base branch** the work is evaluated against. **Never assume** the currently checked-out branch is the base.
- **Detect** the repo default: `origin/HEAD` → `main` → `develop` → `master`.
- **Confirm with the user** whether the work should be based on that branch. Default to the repo default unless the ticket implies otherwise (e.g. a hotfix against a `release/*` branch). If the current branch is not the intended base, STOP and ask.
- **Navigate + pull**: branch from the confirmed base with `git-branch --base <name|default> --pull` — it checks out the base, `--ff-only` pulls latest, then creates the ticket branch from it. It **refuses to switch base on a dirty working tree** (commit or stash first) so in-progress work is never clobbered.
- **Sync context to the base**: run `context-sync --base <the same base>`. If it reports `base-branch-changed` or `context-not-ancestor-of-base`, the cached context is ahead of / diverged from the base (e.g. context built on `main` but the work base is a behind-`main` release hotfix) — rebuild context against the base before planning.

## Commit messages
Format:
```
[JIRA-TICKET]: <description of the commit being made>
```
- Example: `[FXDOMAIN-0000]: add exponential backoff to network client`
- Description: imperative mood, concise, normal prose (not caveman).

Use the **git-commit** skill (`{{SKILLS_DIR}}/git-commit/`) to commit; it validates the format.

## Mandatory pre-commit branch safety check
- This check is **mandatory** and must run **immediately before every commit**.
- It is an explicit guard and does **not** depend on cache, memory, or previously collected branch info.
- Determine the current branch right before committing (for example: `git branch --show-current`).
- If current branch is `main`, `develop`, or any `release` branch (`release` or `release/*`), **pause and ask the user for explicit confirmation** before committing directly to that protected branch.
- Without explicit user confirmation, do not commit on protected branches.
- Preferred behavior: commit only from a non-protected feature/work branch created for the change.

## Tool constraint
Always use the native **`git` CLI** or **`gh` CLI** for all git operations (branch, commit, push, status, etc.).
**Never** use GitKraken MCP tools (`mcp_gitkraken_*`) or any other MCP for git — the built-in CLI is sufficient and avoids unnecessary MCP overhead.
If a utility function is needed for a deterministic task (e.g. branch validation, commit formatting), add it to the relevant `scripts/` folder inside the skill.
