---
name: git-commit
description: Commit changes with a message following the format `[JIRA-TICKET]: <description>`. Validates the format before committing. Runs standalone or as the wrap-up step of the SDLC workflow.
---

# git-commit skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — deterministic; lowest reasoning needed.

## Convention (requirement #13)
```
[JIRA-TICKET]: <description of the commit being made>
```
Example: `[FXDOMAIN-0000]: add exponential backoff to network client`

## Inputs
- `--ticket <JIRA-TICKET>`
- `--message "<description>"` (imperative, normal prose — not caveman)
- optional `--all` to stage all tracked changes first (`git add -A`)

## How to run
```bash
node {{SKILLS_DIR}}/git-commit/scripts/git-commit.mjs --ticket FXDOMAIN-0000 --message "add retry to client" --all
# or:
agentic-workflow run git-commit -- --ticket FXDOMAIN-0000 --message "add retry to client"
```

## Output (TOON)
```
commit:
  message: "[FXDOMAIN-0000]: add retry to client"
  committed: true
  hash: <short-sha>
```

Validation: ticket must match `[A-Z][A-Z0-9]+-\d+`; message must be non-empty. If there is nothing staged (and `--all` not passed) the script emits an `error:` TOON block and exits non-zero.
