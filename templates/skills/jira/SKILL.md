---
name: jira
description: "Deterministically fetch a Jira issue (fields, description, comments, links, Figma links) — or a whole epic with its child issues (--epic) — and emit it as TOON. Use when a ticket's or epic's details are needed. Runs standalone or as the first step of the SDLC / epic-planning workflow."
---

# jira skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — this skill is deterministic; the model only orchestrates the call and interprets results.

## When to use
- The product persona (or a user) needs the full context of a Jira ticket.
- The epic planner needs an epic and all of its child issues.

## Inputs
- `--issue <KEY>` — a single issue, e.g. `FXDOMAIN-1234`.
- `--epic <KEY>` — an epic; returns the epic plus its child issues.

## Required environment
- `ATLASSIAN_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `ATLASSIAN_EMAIL` — account email
- `ATLASSIAN_API_TOKEN` — Atlassian API token

## How to run (deterministic)
```bash
node {{SKILLS_DIR}}/jira/scripts/jira.mjs --issue FXDOMAIN-1234
# or via the CLI:
agentic-workflow run jira -- --issue FXDOMAIN-1234
# an epic and its children:
agentic-workflow run jira -- --epic FXDOMAIN-1000
```

The script prints **TOON** on stdout (caveman FULL). For a single issue it extracts any Figma URLs found in the description/comments into a `figmaLinks[]` block so the figma skill can follow them.

## Output (TOON)
Single issue:
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

Epic:
```
epic:
  key: FXDOMAIN-1000
  summary: ...
  childCount: 4
children[4]{key,summary,type,status,labels}:
  ...
```

On failure the script emits an `error:` TOON block and exits non-zero. Do not assume values — if a field is missing, surface it.
