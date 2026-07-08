---
name: git-branch
description: "Create a git branch that follows the convention <feat|fix|release|chore>/<JIRA-TICKET>_<2-3 word description>. Validates the name before creating. Runs standalone or as the setup step of the SDLC workflow."
---

# git-branch skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; lowest reasoning needed.

## Convention (requirement #12)
```
<feat|fix|release|chore>/<JIRA-TICKET>_<two-to-three word description>
```
Example: `feat/FXDOMAIN-0000_implement-agentic-workflow-cli`

## Inputs
- `--type <feat|fix|release|chore>`
- `--ticket <JIRA-TICKET>` e.g. `FXDOMAIN-0000`
- `--desc "<two or three words>"` (will be slugified)
- `--base <name|default>` (optional) — create the branch **from this base ref** instead of the current HEAD; `default` auto-detects the repo default (`origin/HEAD` → `main` → `develop` → `master`). Prevents the new branch from inheriting stray changes from whatever branch was checked out.
- `--pull` (optional, with `--base`) — `git pull --ff-only` the base before branching so work starts from the latest.

## How to run
```bash
node {{SKILLS_DIR}}/git-branch/scripts/git-branch.mjs --type feat --ticket FXDOMAIN-0000 --desc "implement agentic workflow cli"
# branch a hotfix from a specific base, pulling latest first:
node {{SKILLS_DIR}}/git-branch/scripts/git-branch.mjs --type fix --ticket FXDOMAIN-0000 --desc "hotfix" --base release/1.2 --pull
# or:
agentic-workflow run git-branch -- --type feat --ticket FXDOMAIN-0000 --desc "implement agentic cli" --base default --pull
```

## Output (TOON)
```
branch:
  name: feat/FXDOMAIN-0000_implement-agentic-cli
  base: main
  baseCommit: 535ec03
  created: true
```
(`base`/`baseCommit` are emitted only when `--base` is passed.)

Validation: type must be one of the four; ticket must match `[A-Z][A-Z0-9]+-\d+`; description slug is trimmed to 3 words. When `--base` is passed the script **refuses to switch base if the working tree has uncommitted changes** (commit or stash first) so work is never clobbered. On any violation the script emits an `error:` TOON block and exits non-zero. Do not invent ticket ids — ask the user.
