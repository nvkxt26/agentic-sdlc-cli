# agentic-workflow-cli

![Latest Release](https://img.shields.io/badge/release-v1.5.0-blue)

An installable **agentic SDLC workflow CLI**. It scaffolds a set of AI-agent
customizations — an orchestrator, persona agents, deterministic skills, and
instruction files — into a project so your coding agent can resolve a Jira ticket
end-to-end. Agents communicate using **TOON** (Token-Oriented Object Notation)
with **caveman FULL** compression.

> Works with **GitHub Copilot**, **Claude Code**, and **OpenCode**. The same
> logical components are rendered into each provider's native layout, frontmatter,
> and model naming. Pick one or several with `--provider`.

It also scales up: run it **per repo**, or across a **workspace** (a folder that
groups several repos) to plan whole epics and let each repo's agents consult one
another's context.

---

## Contents

- [Choosing your AI provider](#choosing-your-ai-provider)
- [How installation works](#how-installation-works)
- [Install](#install)
- [Quick start](#quick-start)
- [The SDLC workflow](#the-sdlc-workflow)
- [Ask questions about a repo](#ask-questions-about-a-repo)
- [Working across multiple repos (workspaces)](#working-across-multiple-repos-workspaces)
- [Plan an epic across repos](#plan-an-epic-across-repos)
- [Extend it: write your own agents, skills & instructions](#extend-it-write-your-own-agents-skills--instructions)
- [Codebase context & caching](#codebase-context--caching)
- [Models per task](#models-per-task)
- [Deterministic skills](#deterministic-skills)
- [Credentials](#credentials)
- [Conventions](#conventions)
- [CLI reference](#cli-reference)

---

## Choosing your AI provider

One command, three providers. Choose at install time:

```bash
agentic-workflow init --provider copilot          # default
agentic-workflow init --provider claude
agentic-workflow init --provider opencode
agentic-workflow init --provider copilot,claude   # scaffold several at once
```

Each provider gets its own native layout, frontmatter, and model names:

| | GitHub Copilot | Claude Code | OpenCode |
|---|---|---|---|
| Always-on rules | `.github/copilot-instructions.md` | `CLAUDE.md` | `AGENTS.md` |
| Agents | `.github/agents/*.agent.md` | `.claude/agents/*.md` | `.opencode/agent/*.md` |
| Skills | `.github/skills/<name>/` | `.claude/skills/<name>/` | `.opencode/skills/<name>/` |
| Instructions | `.github/instructions/*.instructions.md` | `.claude/instructions/*.instructions.md` | `.opencode/instructions/*.instructions.md` |
| Prompts / commands | `.github/prompts/*.prompt.md` | `.claude/commands/*.md` | `.opencode/command/*.md` |
| Model naming | `Claude Opus 4.8 (copilot)` | `opus` / `sonnet` / `haiku` | `anthropic/claude-opus-4-1` |

The **template bodies are provider-neutral** — the CLI supplies each provider's
frontmatter (tools, mode, model) and rewrites path references. Model names are just
defaults you can change (see [Models per task](#models-per-task)); OpenCode ids in
particular map to whatever provider you have configured (`anthropic/*`,
`github-copilot/*`, `openai/*`, …).

The provider set is saved in `.agentic-workflow.json` (`"providers"`), so future
`init`/`add` runs reuse it.

---

## How installation works

The CLI ships pre-built customization templates. When you run `init` (or install as
a project dependency), it **renders and copies** those templates into the locations
your provider auto-discovers. All file names and `name` frontmatter fields match the
directory conventions each agent requires — no extra editor settings needed.

### Global install (optional)

Pass `--global` to also install into each configured provider's **user-level**
locations, so the workflow is available in every project:

| Provider | Global locations |
|---|---|
| Copilot | VS Code user `prompts/` (prompts + instructions), `~/.copilot/skills/` |
| Claude Code | `~/.claude/agents`, `~/.claude/commands`, `~/.claude/skills`, `~/.claude/instructions` |
| OpenCode | `~/.config/opencode/{agent,command,skills,instructions}` |

---

## Install

> **Requires Node.js ≥ 22** — the `cache` skill uses Node's built-in `node:sqlite`.

### Option A — Project dependency (recommended)

Files are scaffolded automatically on `npm install` via a `postinstall` hook
(defaults to the Copilot provider; run `init` to add others):

```bash
npm install --save-dev @nvkxt26/agentic-workflow-cli
```

> Skip auto-scaffolding: `npm install --save-dev --ignore-scripts @nvkxt26/agentic-workflow-cli`
> then run `npx agentic-workflow init` manually.

### Option B — Global CLI

```bash
npm install -g @nvkxt26/agentic-workflow-cli
agentic-workflow init                 # interactive (asks which provider[s])
agentic-workflow init -y              # defaults (Copilot), no prompts
agentic-workflow init --global        # also install to user-level locations
```

### Option C — npx (no install)

```bash
npx @nvkxt26/agentic-workflow-cli init
```

### Installing from GitHub Packages

The package is published to GitHub Packages under `@nvkxt26`. Add auth to `~/.npmrc`:

```text
@nvkxt26:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

---

## Quick start

```bash
# 1. Install into your project (choose provider[s])
npx agentic-workflow init --provider copilot

# 2. List installed agents + skills and their models (per provider)
npx agentic-workflow list
```

In your agent: open chat, select the **SDLC Orchestrator** (or run
`/resolve-ticket`), and provide a Jira ticket id.

---

## The SDLC workflow

```
0. setup    → docs/<JIRA>/ + branch (git-branch skill)
0b. context → refresh .agentic/context/ from default-branch diff (context-builder + context-sync)
1. product  → requirements.toon   (Jira + Figma; asks questions, never assumes)
2. architect→ plan.toon           (plans against context; reuses existing components; reuses cache)
3. develop  → dev-report.toon     (comments by default; build verified in code mode)
4. qa       → qa-report.toon      (unit + integration tests)
5. review   → review-log.toon     (loop up to 5×)
6. wrap     → commit (git-commit skill) + human summary
```

Every hand-off between stages is a **TOON** artifact persisted under
`docs/<JIRA>/`. Each skill runs standalone or in-workflow.

The installed agents:

| Agent | Role |
|---|---|
| SDLC Orchestrator | Start here — sequences the full ticket-resolution pipeline |
| Product Owner | Gathers requirements from Jira, Confluence, Figma |
| Context Builder | Maintains codebase context on the default branch (incremental) |
| Architect | Turns requirements into a concrete plan |
| Senior Developer | Applies the plan (comments or real code) |
| QA | Adds/updates unit + integration tests |
| Code Reviewer | Review loop until clean |
| **Repo Q&A** | Answers any question about the repo; refreshes context first when stale |
| **Epic Planner** | Plans a whole epic across a group of repos |

---

## Ask questions about a repo

The **Repo Q&A** agent (prompt `/ask-repo`) answers any question about the current
repository — "where is auth handled?", "what would change to add SSO?" — grounded in
real code and the generated context. Crucially, it **updates the context beforehand
if it's stale**: it runs the `context-sync` skill, and if the default branch has
moved since the last index, it refreshes via the context-builder before answering.

```
/ask-repo where are retries configured for the payments client?
```

It answers a **human** in plain prose (with `path:line` citations), and answers
**another repo's agent** in compact TOON via the repo-bridge channel (below).

---

## Working across multiple repos (workspaces)

A **workspace** is a folder that groups several repos (think of a VS Code workspace,
or a directory where you clone all your services). Mark it once:

```bash
cd ~/work/my-workspace        # contains repoA/ repoB/ repoC/
agentic-workflow workspace init
```

This:
- discovers member repos (immediate sub-dirs that are git repos),
- writes `.agentic-workspace.json`,
- installs the **workspace-level** agents (orchestrator, epic-planner, repo-qa …) at
  the workspace root, and
- creates the shared **context registry** at `.agentic/registry/` (git-ignored).

Then install per repo and publish each repo's context to the registry:

```bash
# in each repo:
agentic-workflow init

# from anywhere in the workspace, publish everyone's context:
agentic-workflow workspace sync
agentic-workflow workspace list      # who is installed / published
```

### How repos communicate (cross-repo context)

Agents never reach blindly into a sibling repo. They use the deterministic
**repo-bridge** skill as the transport, paired with each repo's **Repo Q&A** agent as
the intelligence:

```bash
# publish THIS repo's context (the context-builder does this automatically)
agentic-workflow run repo-bridge -- publish

# read peers
agentic-workflow run repo-bridge -- list
agentic-workflow run repo-bridge -- read --repo billing --file modules.toon

# agent-to-agent Q&A (file mailbox in the registry)
agentic-workflow run repo-bridge -- ask --repo billing --question "do you own invoice PDFs?"
agentic-workflow run repo-bridge -- inbox                 # billing's repo-qa reads this
agentic-workflow run repo-bridge -- answer --id <id> --file answer.toon
agentic-workflow run repo-bridge -- answers --id <id>     # asker collects the reply
```

Everything is plain files under `.agentic/registry/` — no server, fully deterministic.

---

## Plan an epic across repos

The **Epic Planner** agent (prompt `/plan-epic`) plans a whole Jira **epic**, not just
one ticket. It:

1. fetches the epic and its child issues (`jira` skill `--epic`),
2. lists the workspace repos and their published context (`repo-bridge -- list`),
3. **routes each ticket to the repo(s) that must change** — matching intent against
   each repo's context and, when unclear, **asking that repo's Repo Q&A agent
   directly** through repo-bridge,
4. sequences tickets by cross-repo dependencies (producer before consumer), and
5. emits `docs/<EPIC>/epic-plan.toon` — a per-ticket, per-repo, ordered plan.

```
/plan-epic FXDOMAIN-1000
```

Each `(ticket, repo)` work item is then independently resolvable with
`/resolve-ticket` **inside the target repo**, so the resolution plan for each Jira
ticket is targeted at the right repository.

---

## Extend it: write your own agents, skills & instructions

Everything the CLI installs is a plain Markdown/`.mjs` file in your provider's folder,
so you can **add your own** — no code changes to this package required. Drop a file in
the right place and your agent auto-discovers it.

### Add an instruction (a rule that's always applied)

Instructions are the simplest way to teach the workflow your project's conventions.

**Example — "use our custom component library instead of generic components":**

Create `.github/instructions/ui-components.instructions.md` (Copilot; use
`.claude/instructions/` or `.opencode/instructions/` for the others):

```md
---
applyTo: '**'
description: Build UI only from our in-house component library.
---

# UI components — use our library

Before writing any UI, search `src/components/ui/` (our component library).
- Reuse an existing component (`<Button>`, `<Modal>`, `<DataTable>` …). Match its props/variants.
- Never introduce raw HTML controls or a third-party UI kit when ours has an equivalent.
- Only create a new component when nothing fits — and note why in the plan.
- Follow the folder/naming/token conventions in `src/components/ui/README.md`.
```

That's it — the agent now walks your component library and reuses it. A generic
version of this rule (`project-conventions.instructions.md`) ships by default; the
above just makes it specific to your codebase.

### Add an agent (a persona / mode)

Create a file in your agents dir. **Copilot** (`.github/agents/db-migrations.agent.md`):

```md
---
description: DB Migration Reviewer — checks every schema change for safety and rollback.
model: Claude Sonnet 4.5 (copilot)
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# DB Migration Reviewer
Review any migration for: backwards compatibility, lock risk, index build cost,
and a tested rollback path. Emit findings as TOON. Never approve an irreversible
migration without an explicit rollback.
```

The equivalent **Claude Code** agent uses `name:`/`tools: Read, Grep, …`; **OpenCode**
uses `mode:`/`model: provider/model` and a `tools:` map. See the installed agents for
a copy-paste template per provider.

### Add a skill (a deterministic tool or a task recipe)

A skill is a folder with a `SKILL.md`; add a `scripts/*.mjs` for deterministic work.
**`.github/skills/changelog/SKILL.md`:**

```md
---
name: changelog
description: Generate a changelog entry from the current branch's commits. Use when wrapping a ticket.
---

# changelog skill
Run: `node .github/skills/changelog/scripts/changelog.mjs --since main`
Emits a TOON list of `{type, scope, message}` from Conventional Commits.
```

Keep scripts **zero-dependency** and have them print **TOON** on stdout (copy the tiny
encoder from any shipped skill) so they compose with the rest of the workflow. Run any
skill with `agentic-workflow run <name> -- <args>`.

### Where to add things (three levels)

- **Per repo** — files in the repo's provider folder. Apply to that repo only.
- **Workspace** — files at the workspace root's provider folder (created by
  `workspace init`). Apply across the group (e.g. the epic planner, shared rules).
- **Global** — install with `--global`, or drop files in the user-level locations
  above. Apply to every project on your machine.

Because discovery is by folder, you can layer all three: repo-specific rules override
or extend workspace and global ones.

---

## Codebase context & caching

- **Context** — the **context-builder** agent maintains a map of the codebase on the
  default branch. The **context-sync** skill emits only the file diff since the last
  indexed commit (full list on first run), so context updates incrementally. Context
  lives in `.agentic/context/`; the marker in `.agentic/context/context-meta.json`.
- **Cache** — the **cache** skill is a SQLite key/value store (`node:sqlite`, hence
  Node ≥ 22) at `.agentic/cache/cache.db`. Stages check it before fetching/recomputing
  and store results after, to save tokens.
- **Registry** — in a workspace, each repo publishes its context to
  `.agentic/registry/<repo>/` for peers to read.

`.agentic/context/`, `.agentic/cache/` and `.agentic/registry/` are generated,
regenerable state and are added to `.gitignore` automatically — never committed.
Locations are configurable in `.agentic-workflow.json`.

---

## Models per task

Each agent/skill maps to a reasoning **tier**; each provider resolves the tier to a
concrete model:

| Tier | Copilot | Claude Code | OpenCode (default) |
|---|---|---|---|
| `reasoning-max` | Claude Opus 4.8 | `opus` | `anthropic/claude-opus-4-1` |
| `reasoning-high` | Claude Sonnet 4.5 | `sonnet` | `anthropic/claude-sonnet-4-5` |
| `coding` | Claude Sonnet 4.5 | `sonnet` | `anthropic/claude-sonnet-4-5` |
| `balanced` | GPT-5 mini | `sonnet` | `anthropic/claude-sonnet-4-5` |
| `light` | GPT-5 mini | `haiku` | `anthropic/claude-3-5-haiku-latest` |

Override the tier for any component (persisted to `.agentic-workflow.json`):

```bash
agentic-workflow add architect --model reasoning-high
```

To change the concrete **model names**, edit the model maps in the generated agent
files, or adjust them at the source (`src/models.ts`) if you maintain a fork.

---

## Deterministic skills

Integrations that should not be left to the model run as scripts and emit TOON:

```bash
agentic-workflow run jira -- --issue FXDOMAIN-1234
agentic-workflow run jira -- --epic FXDOMAIN-1000
agentic-workflow run confluence -- --id 123456
agentic-workflow run figma -- --url "https://www.figma.com/design/KEY/Name?node-id=12-34" --out docs/FXDOMAIN-1234/figma
agentic-workflow run git-branch -- --type feat --ticket FXDOMAIN-1234 --desc "add retry"
agentic-workflow run git-commit -- --ticket FXDOMAIN-1234 --message "add retry" --all
agentic-workflow run context-sync -- --context-dir .agentic/context
agentic-workflow run cache -- get --key jira:FXDOMAIN-1234 --raw
agentic-workflow run repo-bridge -- list
```

---

## Credentials

`init` asks for the environment variables the skills need and writes any provided
values to a gitignored `.env` / your shell profile:

| Variable | Used by |
|---|---|
| `ATLASSIAN_BASE_URL` | Jira, Confluence |
| `ATLASSIAN_EMAIL` | Jira, Confluence |
| `ATLASSIAN_API_TOKEN` | Jira, Confluence |
| `FIGMA_API_TOKEN` | Figma |

---

## Conventions

- **Branch:** `<feat|fix|release|chore>/<JIRA>_<2-3 word desc>` e.g. `feat/FXDOMAIN-0001_add-retry-logic`
- **Commit:** `[JIRA-TICKET]: <description>`
- **Output mode:** defaults to **comments** (marks where code goes); set to **code** to write real implementation.
- **Never assume:** every agent stops and asks numbered questions when context is missing.
- **Reuse project conventions:** prefer existing components/utilities over generic ones.

---

## CLI reference

| Command | Description |
|---|---|
| `init [-y] [--provider <ids>] [--global]` | Scaffold into the project for the chosen provider(s) |
| `list` / `ls` | List agents and skills with their resolved models per provider |
| `add <skill\|agent> [--model <tier>] [--provider <ids>]` | Add one component |
| `run <skill> -- <args>` | Run a deterministic skill script (emits TOON) |
| `workspace init [-y] [--provider <ids>]` | Mark a folder as a workspace; install workspace agents |
| `workspace list` | List member repos and their install/publish state |
| `workspace sync` | Publish each repo's context into the shared registry |

`--provider` accepts a comma list of `copilot`, `claude`, `opencode`.

---

## Development

```bash
npm install
npm run build      # tsc → dist/
npm run dev -- list
```

---

## License

[GNU GPL v3](./LICENSE) — free to use, modify, and distribute; any distribution of this software or derivative works must be released under the same GPL v3 terms with source code made available.
