---
name: jira
description: "Deterministically fetch a Jira issue (fields, description, comments, links, Figma links) — or a whole epic with its child issues (--epic) — or a list of tickets matching a sprint/JQL query (--sprint/--jql) — and emit it as TOON. Also lists (--list-transitions) and applies (--transition) workflow status changes in single or multiple hops. Use when a ticket's, epic's, or sprint's details are needed, or to move a ticket's status. Runs standalone or as the first step of the SDLC / epic-planning / batch-resolution workflow."
---

# jira skill

Default model tier: `{{TIER}}` (`{{MODEL}}`) — this skill is deterministic; the model only orchestrates the call and interprets results.

## When to use
- The product persona (or a user) needs the full context of a Jira ticket.
- The epic planner needs an epic and all of its child issues.
- The batch resolver needs a list of tickets from a sprint or JQL query.

## Inputs
- `--issue <KEY>` — a single issue, e.g. `FXDOMAIN-1234`.
- `--epic <KEY>` — an epic; returns the epic plus its child issues.
- `--sprint <id|active>` — fetch tickets from a sprint (numeric id or `active` for open sprints) assigned to the current user (or `--assignee` override).
- `--jql <query>` — raw JQL query string (automatically appends `ORDER BY priority DESC, created ASC` unless the query already contains an order-by clause).
- `--assignee <user>` — override the default `currentUser()` assignee filter when combined with `--sprint` or as standalone assignee query.
- `--board <id>` — (optional, informational only; board is not a JQL field) — ignored unless combined with a sprint/assignee query.
- `--list-transitions` (with `--issue`) — list the issue's current status and the transitions available from it (read-only).
- `--transition <status>` (with `--issue`) — move the issue to the named target status, following the project's workflow in one or more hops. `--max-hops <n>` caps the walk (default 5).

## Required environment
- `ATLASSIAN_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `ATLASSIAN_EMAIL` — account email
- `ATLASSIAN_API_TOKEN` — Atlassian API token

## How to run (deterministic)
```bash
# single issue
node {{SKILLS_DIR}}/jira/scripts/jira.mjs --issue FXDOMAIN-1234
# or via the CLI:
agentic-sdlc run jira -- --issue FXDOMAIN-1234

# an epic and its children:
agentic-sdlc run jira -- --epic FXDOMAIN-1000

# tickets from active sprint assigned to current user
agentic-sdlc run jira -- --sprint active

# tickets from a specific sprint
agentic-sdlc run jira -- --sprint 123

# raw JQL query
agentic-sdlc run jira -- --jql "assignee = currentUser() AND status != Done"

# list available workflow transitions from the current status
agentic-sdlc run jira -- --issue FXDOMAIN-1234 --list-transitions

# move the issue to "In Progress" (single or multi hop through the workflow)
agentic-sdlc run jira -- --issue FXDOMAIN-1234 --transition "In Progress"
```

The script prints **TOON** on stdout (caveman FULL). For a single issue it extracts any Figma URLs found in the description/comments into a `figmaLinks[]` block so the figma skill can follow them.

## Workflow transitions (status changes)
Two flags drive a Jira issue's status through its project workflow:

- `--list-transitions` is **read-only**: it reports the current status and every transition available from it (each with its target status). Use it to preview options before changing anything.
- `--transition <status>` moves the issue toward the named target. Jira's API only exposes the transitions available from the *current* status, so the skill walks the workflow greedily: at each hop it takes the direct transition to the target when one exists, otherwise steps to the first unvisited status and re-evaluates. It never revisits a status (cycle-safe) and stops after `--max-hops` (default 5). If the target is already the current status it reports `already-there` and changes nothing; if the target cannot be reached it emits an `error:` block listing the available transitions.

This is a **mutating** action — callers (the resolve-ticket / resolve-assigned workflows) must obtain explicit user confirmation before invoking `--transition`. Status name matching is case-insensitive.

## Custom-field discovery (self-learning, automatic)
Standard Jira fields alone miss data held in **custom fields** — most importantly **Acceptance Criteria** (`customfield_10903` on one account, but the id varies per Atlassian site). The skill discovers these automatically — no configuration, no env vars, no prompts:

1. It reads the site's field catalog (`GET /rest/api/3/field`) and picks custom fields whose display name matches the acceptance heuristic (`/acceptance/i`).
2. It requests those candidate ids alongside the standard fields and takes the first non-empty value as `acceptance[]`.
3. On a miss it expands to `fields=*all`, re-scans, and **learns** the discovered field id.
4. Learned ids are cached per Atlassian host in `.agentic/cache/jira-fields.json` (git-ignored) and tried **first** on later runs, so the cache grows and stays current. Any field / cache read failure degrades gracefully to the standard fields — the fetch never crashes.

## Sprint → JQL mapping
When `--sprint` is provided, the skill builds a JQL query:
- `--sprint <id>` (numeric) → `sprint = <id> AND assignee = currentUser() ORDER BY priority DESC, created ASC`
- `--sprint active` → `sprint in openSprints() AND assignee = currentUser() ORDER BY priority DESC, created ASC`
- Optional `--assignee <name>` overrides `currentUser()`.

**Note**: The `sprint` JQL field requires Jira Agile/boards to be enabled. If the project does not use boards, the query will fail with a Jira error (surfaced verbatim as an `error:` TOON block).

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
customFields[C]{name,value}:
  ...
comments[K]{author,body}:
  ...
links[L]{type,key,summary}:
  ...
figmaLinks[F]: ...
```

`acceptance[]` holds the discovered Acceptance-Criteria lines (empty → `acceptance[0]`). `customFields[]` lists any other non-empty acceptance-matched custom fields and is omitted when empty.

Epic:
```
epic:
  key: FXDOMAIN-1000
  summary: ...
  childCount: 4
children[4]{key,summary,type,status,labels}:
  ...
```

Sprint/JQL query:
```
query:
  jql: sprint = 123 AND assignee = currentUser() ORDER BY priority DESC, created ASC
  count: 7
tickets[7]{key,summary,type,status,priority,created,assignee}:
  FXDOMAIN-1234,implement feature X,Story,In Progress,High,2026-07-15,Jane Doe
  ...
```

Empty result → `tickets[0]`.

Workflow transitions:
```
# --list-transitions
transitions:
  issue: FXDOMAIN-1234
  status: To Do
  count: 2
available[2]{name,to}:
  Start Progress,In Progress
  Backlog,Backlog

# --transition "In Progress"
transition:
  issue: FXDOMAIN-1234
  from: To Do
  to: In Progress
  hops: 1
  status: done
path[1]: In Progress
```

`status` is `done` (target reached), `already-there` (no change needed), and `path[]` lists the statuses stepped through in order. Unreachable target → `error:` block with the available transitions.

On failure the script emits an `error:` TOON block and exits non-zero. Do not assume values — if a field is missing, surface it.
