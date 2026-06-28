---
name: jira
description: Deterministically fetch a Jira issue (summary, description, status, labels, comments, linked issues, and any Figma links) and emit it as TOON. Use when a ticket's details are needed. Runs standalone or as the first step of the SDLC workflow.
---

# jira skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — this skill is deterministic; the model only orchestrates the call and interprets results.

## When to use
- The product persona (or a user) needs the full context of a Jira ticket.

## Inputs
- Issue key, e.g. `FXDOMAIN-1234`.

## Required environment
- `ATLASSIAN_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `ATLASSIAN_EMAIL` — account email
- `ATLASSIAN_API_TOKEN` — Atlassian API token

## How to run (deterministic)
```bash
node .github/skills/jira/scripts/jira.mjs --issue FXDOMAIN-1234
# or via the CLI:
agentic-workflow run jira -- --issue FXDOMAIN-1234
```

The script prints **TOON** on stdout (caveman FULL). It extracts any Figma URLs found in the description/comments into a `figmaLinks[]` block so the figma skill can follow them.

## Output (TOON)
```
issue:
  key: FXDOMAIN-1234
  summary: ...
  status: ...
  type: ...
labels[N]: ...
acceptance[M]:
  - ...
comments[K]{author,body}:
  ...
links[L]{type,key,summary}:
  ...
figmaLinks[F]: ...
```

On failure the script emits an `error:` TOON block and exits non-zero. Do not assume values — if a field is missing, surface it.
