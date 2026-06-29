---
applyTo: '**'
description: Git branch and commit message conventions for the agentic workflow.
---

# Git conventions

## Branch names (requirement #12)
Pattern:
```
<feat|fix|release|chore>/<JIRA-TICKET>_<two-to-three word description>
```
- Type chosen from the ticket: feature → `feat`, bug → `fix`, release → `release`, maintenance → `chore`.
- Description: 2–3 words, lowercase, hyphen-separated.
- Example: `feat/FXDOMAIN-0000_implement-agentic-workflow-cli`

Use the **git-branch** skill (`.github/skills/git-branch/`) to create branches; it validates the pattern.

## Commit messages (requirement #13)
Format:
```
[JIRA-TICKET]: <description of the commit being made>
```
- Example: `[FXDOMAIN-0000]: add exponential backoff to network client`
- Description: imperative mood, concise, normal prose (not caveman).

Use the **git-commit** skill (`.github/skills/git-commit/`) to commit; it validates the format.

## Tool constraint
Always use the native **`git` CLI** or **`gh` CLI** for all git operations (branch, commit, push, status, etc.).
**Never** use GitKraken MCP tools (`mcp_gitkraken_*`) or any other MCP for git — the built-in CLI is sufficient and avoids unnecessary MCP overhead.
If a utility function is needed for a deterministic task (e.g. branch validation, commit formatting), add it to the relevant `scripts/` folder inside the skill.
