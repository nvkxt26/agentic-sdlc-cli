---
name: git-branch
description: Create a git branch that follows the convention <feat|fix|release|chore>/<JIRA-TICKET>_<2-3 word description>. Validates the name before creating. Runs standalone or as the setup step of the SDLC workflow.
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

## How to run
```bash
node {{SKILLS_DIR}}/git-branch/scripts/git-branch.mjs --type feat --ticket FXDOMAIN-0000 --desc "implement agentic workflow cli"
# or:
agentic-workflow run git-branch -- --type feat --ticket FXDOMAIN-0000 --desc "implement agentic cli"
```

## Output (TOON)
```
branch:
  name: feat/FXDOMAIN-0000_implement-agentic-cli
  created: true
```

Validation: type must be one of the four; ticket must match `[A-Z][A-Z0-9]+-\d+`; description slug is trimmed to 3 words. On any violation the script emits an `error:` TOON block and exits non-zero. Do not invent ticket ids — ask the user.
