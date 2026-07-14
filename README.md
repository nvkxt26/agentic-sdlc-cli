# agentic-sdlc-cli

![Latest Release](https://img.shields.io/badge/release-v2.2.0-blue)

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
- [Optional: knowledge graph with graphify](#optional-knowledge-graph-with-graphify)
- [Models per task](#models-per-task)
- [Deterministic skills](#deterministic-skills)
- [Credentials](#credentials)
- [Conventions](#conventions)
- [CLI reference](#cli-reference)
- [Development](#development)

---

## Choosing your AI provider

One command, three providers. Choose at install time:

```bash
agentic-sdlc init --provider copilot          # default
agentic-sdlc init --provider claude
agentic-sdlc init --provider opencode
agentic-sdlc init --provider copilot,claude   # scaffold several at once
```

Each provider gets its own native layout, frontmatter, and model names:

| | GitHub Copilot | Claude Code | OpenCode |
|---|---|---|---|
| Always-on rules | `.github/copilot-instructions.md` | `CLAUDE.md` | `AGENTS.md` |
| Agents | `.github/agentic-sdlc/agents/*.agent.md` | `.claude/agents/*.md` | `.opencode/agent/*.md` |
| Skills | `.github/agentic-sdlc/skills/<name>/` | `.claude/skills/<name>/` | `.opencode/skills/<name>/` |
| Instructions | `.github/agentic-sdlc/instructions/*.instructions.md` | `.claude/instructions/*.instructions.md` | `.opencode/instructions/*.instructions.md` |
| Prompts / commands | `.github/agentic-sdlc/prompts/*.prompt.md` | `.claude/commands/*.md` | `.opencode/command/*.md` |
| Model naming | `Claude Opus 4.8 (copilot)` | `opus` / `sonnet` / `haiku` | `anthropic/claude-opus-4-1` |

The **template bodies are provider-neutral** — the CLI supplies each provider's
frontmatter (tools, mode, model) and rewrites path references. Model names are just
defaults you can change (see [Models per task](#models-per-task)); OpenCode ids in
particular map to whatever provider you have configured (`anthropic/*`,
`github-copilot/*`, `openai/*`, …).

The provider set is saved in `.agentic-sdlc.json` (`"providers"`), so future
`init`/`add` runs reuse it.

When shared template rules change, re-run `init`/`add` for each installed
provider so rendered files are refreshed (`.github/copilot-instructions.md`,
`CLAUDE.md`, `AGENTS.md`, and provider instruction folders). For example, the
protected-branch commit guard (`main`/`develop`/`release*`) is defined once in
templates and then rendered into each provider layout.

If an older repo still has `.agentic-workflow.json`, the CLI will continue to
read it for backward compatibility. New writes use `.agentic-sdlc.json`.

---

## How installation works

The CLI ships pre-built customization templates. When you run `init` (or install as
a project dependency), it **renders and copies** those templates into the locations
your provider auto-discovers. All file names and `name` frontmatter fields match the
directory conventions each agent requires — no extra editor settings needed.

For **GitHub Copilot**, generated agents/prompts/instructions/skills are grouped under
`.github/agentic-sdlc/`. The always-on file stays at `.github/copilot-instructions.md`.
`init` also writes `.vscode/settings.json` so VS Code discovers those custom locations via
`chat.agentFilesLocations`, `chat.promptFilesLocations`, and `chat.instructionsFilesLocations`.

During interactive `init`, the CLI also asks whether it should create/update
`.vscode/settings.json` with **safe terminal auto-approval rules** for common
workflow setup/product-stage commands:
- `mkdir -p docs/tickets/...`
- `agentic-sdlc run git-branch`
- `agentic-sdlc run jira|confluence|figma|context-sync|cache|repo-bridge|graphify`

Use `--no-vscode-settings` to skip this.

By default, `init` also adds `.github/agentic-sdlc/` and `.vscode/settings.json`
to `.gitignore`. Use `--no-gitignore-sdlc` to opt out and commit those files.

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
npm install --save-dev @nvkxt26/agentic-sdlc-cli
```

> Skip auto-scaffolding: `npm install --save-dev --ignore-scripts @nvkxt26/agentic-sdlc-cli`
> then run `npx agentic-sdlc init` manually.

### Option B — Global CLI

```bash
npm install -g @nvkxt26/agentic-sdlc-cli
agentic-sdlc init                 # interactive (asks which provider[s])
agentic-sdlc init -y              # defaults (Copilot), no prompts
agentic-sdlc init --global        # also install to user-level locations
agentic-sdlc init --no-vscode-settings   # skip .vscode/settings.json auto-approve rules
agentic-sdlc init --no-gitignore-sdlc    # keep .github/agentic-sdlc + .vscode/settings.json tracked
```

### Option C — npx (no install)

```bash
npx @nvkxt26/agentic-sdlc-cli init
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
npx agentic-sdlc init --provider copilot

# 2. List installed agents + skills and their models (per provider)
npx agentic-sdlc list
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
2b. approve → user approves `plan.toon` before any source edits
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
| **Mimir** | Answers any question about the repo; refreshes context first when stale |
| **Epic Planner** | Plans a whole epic across a group of repos |

---

## Ask questions about a repo

**Mimir** (prompt `/ask-repo`) answers any question about the current
repository — "where is auth handled?", "what would change to add SSO?" — grounded in
real code and the generated context. Crucially, it **updates the context beforehand
if it's stale**: it runs the `context-sync` skill, and if the default branch has
moved since the last index, it refreshes via the context-builder before answering.

> In Norse mythology, Mimir is the being Odin himself consults for wisdom — legend has
> it Odin even keeps Mimir's severed, preserved head around specifically to ask it
> questions. Our Mimir only asks for a stale-context refresh in return, which is
> honestly a much better deal.

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
agentic-sdlc workspace init
```

This:
- discovers member repos (immediate sub-dirs that are git repos),
- writes `.agentic-workspace.json`,
- installs the **workspace-level** agents (orchestrator, epic-planner, mimir …) at
  the workspace root, and
- creates the shared **context registry** at `.agentic/registry/` (git-ignored).

Then install per repo and publish each repo's context to the registry:

```bash
# in each repo:
agentic-sdlc init

# from anywhere in the workspace, publish everyone's context:
agentic-sdlc workspace sync
agentic-sdlc workspace list      # who is installed / published
```

### How repos communicate (cross-repo context)

Agents never reach blindly into a sibling repo. They use the deterministic
**repo-bridge** skill as the transport, paired with each repo's **Mimir** agent as
the intelligence:

```bash
# publish THIS repo's context (the context-builder does this automatically)
agentic-sdlc run repo-bridge -- publish

# read peers
agentic-sdlc run repo-bridge -- list
agentic-sdlc run repo-bridge -- read --repo billing --file modules.toon

# agent-to-agent Q&A (file mailbox in the registry)
agentic-sdlc run repo-bridge -- ask --repo billing --question "do you own invoice PDFs?"
agentic-sdlc run repo-bridge -- inbox                 # billing's mimir reads this
agentic-sdlc run repo-bridge -- answer --id <id> --file answer.toon
agentic-sdlc run repo-bridge -- answers --id <id>     # asker collects the reply
```

Everything is plain files under `.agentic/registry/` — no server, fully deterministic.

---

## Plan an epic across repos

The **Epic Planner** agent (prompt `/plan-epic`) plans a whole Jira **epic**, not just
one ticket. It:

1. fetches the epic and its child issues (`jira` skill `--epic`),
2. lists the workspace repos and their published context (`repo-bridge -- list`),
3. **routes each ticket to the repo(s) that must change** — matching intent against
   each repo's context and, when unclear, **asking that repo's Mimir agent
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

## Review a pull request

The prompt `/review-pr` reviews a PR as a **critical senior developer / architect**.
Give it a PR link or number. It:

1. fetches the PR metadata (description, branch, changed files) via the `gh` CLI —
   **without the diff yet**, so its baseline stays unbiased,
2. **extracts the Jira ticket** from the PR description / branch / title,
3. refreshes the codebase context (`context-sync`) so the baseline reflects the real tree,
4. gathers requirements through the **Product Owner** (`jira` skill) and **asks for
   clarifications** until acceptance criteria are finalized,
5. builds the solution it would write via the **Architect** and persists it to
   `docs/<TICKET>/review-plan.toon` — an independent, auditable baseline,
6. **only then pulls the diff** and compares the PR against that baseline — flagging
   accuracy gaps, inefficiencies, missing edge cases, new bugs/regressions, security
   issues, and coding-standard violations,
7. emits `docs/<TICKET>/pr-review.toon` with a verdict, plus a plain-prose summary,
8. **discusses the findings with you** and updates the artifact until you conclude, then
9. **asks for confirmation** before posting — on *yes* it posts the agreed comments to
   the PR via the `gh` CLI, on *no* it posts nothing.

```
/review-pr https://github.com/org/repo/pull/42
```

It never edits source or pushes, and it only posts to the PR after you explicitly
confirm.

---

## Extend it: write your own agents, skills & instructions

Everything the CLI installs is a plain Markdown/`.mjs` file in your provider's folder,
so you can **add your own** — no code changes to this package required. Drop a file in
the right place and your agent auto-discovers it.

### Add an instruction (a rule that's always applied)

Instructions are the simplest way to teach the workflow your project's conventions.

**Example — "use our custom component library instead of generic components":**

Create `.github/agentic-sdlc/instructions/ui-components.instructions.md` (Copilot; use
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

Create a file in your agents dir. **Copilot** (`.github/agentic-sdlc/agents/db-migrations.agent.md`):

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
**`.github/agentic-sdlc/skills/changelog/SKILL.md`:**

```md
---
name: changelog
description: Generate a changelog entry from the current branch's commits. Use when wrapping a ticket.
---

# changelog skill
Run: `node .github/agentic-sdlc/skills/changelog/scripts/changelog.mjs --since main`
Emits a TOON list of `{type, scope, message}` from Conventional Commits.
```

Keep scripts **zero-dependency** and have them print **TOON** on stdout (copy the tiny
encoder from any shipped skill) so they compose with the rest of the workflow. Run any
skill with `agentic-sdlc run <name> -- <args>`.

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
Locations are configurable in `.agentic-sdlc.json`.

---

## Optional: knowledge graph with graphify

[graphify](https://github.com/Graphify-Labs/graphify) (`graphifyy` on PyPI) is an
independent, open-source tool that maps a repo — code (via tree-sitter, offline, no
API key), docs, PDFs, images — into a **queryable knowledge graph**
(`graphify-out/graph.json`) with relationships, god-nodes and cross-file connections
the flat `overview.toon`/`modules.toon` can't express. It is **entirely optional and
additive**: the built-in TOON context above is the source of truth and keeps working
unchanged whether or not graphify is installed.

**Setup happens automatically during `init`** (best-effort, never blocks or fails the
rest of the install):
1. Detects the `graphify` CLI on `PATH`.
2. If missing and you're running interactively, prompts to install it (`uv tool install
   graphifyy`, falling back to `pipx`/`pip`). Skipped automatically with `-y`/`--yes`
   (no surprise network calls in non-interactive/CI runs) — install it yourself anytime:
   ```bash
   uv tool install graphifyy && graphify install
   ```
3. If available, registers graphify's own skill + always-on instructions for each
   configured provider, and builds the initial (offline, code-only) graph.
4. Records the outcome in `.agentic-sdlc.json` (`"graphify": true|false`).

Opt out entirely with `agentic-sdlc init --no-graphify`.

**How it's used:**
- **context-builder** refreshes the graph (`graphify -- build --update`) alongside the
  TOON docs on every context sync, and may pull god-nodes/surprising-connections into
  `overview.toon`. Skipped silently if graphify isn't available.
- **mimir** / `/ask-repo` prefer `graphify -- query "<question>"` (or `path`/`explain`)
  for *relationship* questions ("what connects X to Y", "what breaks if I change Z"),
  falling back to the TOON context for everything else or when graphify is unavailable.
- Call it directly any time:
  ```bash
  agentic-sdlc run graphify -- status
  agentic-sdlc run graphify -- build
  agentic-sdlc run graphify -- query "what connects auth to the database?"
  agentic-sdlc run graphify -- path "UserService" "DatabasePool"
  agentic-sdlc run graphify -- explain "RateLimiter"
  ```

`graphify-out/` is meant to be committed (a shared map for the whole team); only
`graphify-out/cost.json` and the local interpreter marker are git-ignored automatically.

### graphify references

- Repo: [github.com/Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)
- PyPI package (note the double-y): [pypi.org/project/graphifyy](https://pypi.org/project/graphifyy/)
- Architecture: [ARCHITECTURE.md](https://github.com/Graphify-Labs/graphify/blob/v8/ARCHITECTURE.md)
- Benchmarks (LOCOMO / LongMemEval-S recall vs. mem0, grep+read baselines): [BENCHMARKS.md](https://github.com/Graphify-Labs/graphify/blob/v8/BENCHMARKS.md)
- Changelog: [CHANGELOG.md](https://github.com/Graphify-Labs/graphify/blob/v8/CHANGELOG.md)
- Agent-facing instructions used by the `/graphify` skill: [AGENTS.md](https://github.com/Graphify-Labs/graphify/blob/v8/AGENTS.md)
- Discord community: [discord.gg/598Ad9zQZ](https://discord.gg/598Ad9zQZ)
- License: MIT ([LICENSE](https://github.com/Graphify-Labs/graphify/blob/v8/LICENSE))

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

Override the tier for any component (persisted to `.agentic-sdlc.json`):

```bash
agentic-sdlc add architect --model reasoning-high
```

To change the concrete **model names**, edit the model maps in the generated agent
files, or adjust them at the source (`src/models.ts`) if you maintain a fork.

### How the model pin is actually enforced (per provider)

Writing `model:` into an agent's frontmatter isn't itself a guarantee — it only
takes effect if the host you're running in (1) reads that field and (2) the
persona is reached through **delegation** (its own subagent turn), not by another
agent answering that stage inline. This differs by provider:

| Provider | Enforcement | What this repo does to make it reliable |
|---|---|---|
| **OpenCode** | Host-enforced for both primary agents (switching to one in the TUI switches models) and subagents (the `task` tool always runs the target under its own `model:`). Strongest guarantee. | Nothing extra needed — `mode: primary\|subagent` + `model:` is sufficient. |
| **Claude Code** | Honored **only** when the persona is invoked as a subagent via the `Task` tool. | `sdlc-orchestrator.agent.md` and `mimir.agent.md` explicitly instruct: delegate by name via the subagent tool, never answer a stage inline. |
| **Copilot** (VS Code + CLI, same `.github/agentic-sdlc/agents/*.agent.md` files) | Subagent model priority is *explicit param → the subagent's own `model:` → the invoking agent's model* — **but a subagent's requested model can never exceed the cost tier of the agent that invoked it**; a cheaper coordinator silently downgrades every subagent it calls. | 1) `model:` is emitted as an **array** (`model: ['Claude Opus 4.8 (copilot)', ...fallbacks]`) so VS Code tries each in order instead of silently falling back to the currently-picked model if the primary is unavailable to the user's plan. 2) The **SDLC Orchestrator** is pinned to `reasoning-max` (not the lighter tier its own sequencing work would need) specifically so it's never the cost ceiling for the personas it delegates to. 3) Subagent-only personas get `user-invocable: false` (hidden from the top-level agent picker — same intent as OpenCode's `mode: subagent`). 4) Coordinating agents (`sdlc-orchestrator`, `mimir`) get an `agents:` allowlist naming exactly which personas they may invoke, so Copilot can't pick an unintended similarly-named agent. |

Two residual caveats no configuration can close:
- **Unavailable model, no error.** If none of the pinned models (primary + fallbacks) are enabled for the user's plan, hosts generally fall back silently rather than erroring.
- **Nothing verifies compliance after the fact** from this repo's side. To actually *see* which model ran (not just which was configured), see the model-usage logger below.

### Which model actually ran? (model-usage logging)

The tier table above is the *intended* model per agent. To see which model each
agent **actually** ran on, `init` installs a per-provider logger that appends a
`START`/`END` line for every agent turn to `.agentic/logs/model-usage.log`
(git-ignored). What it can capture differs by runtime — because only some hosts
expose the resolved model to a hook/plugin:

| Provider | Mechanism installed | Model logged |
|---|---|---|
| **OpenCode** | plugin `.opencode/plugins/agentic-model-logger.js` (reads `message.updated` events) | **Actual** resolved `provider/model` |
| **Claude Code** | `Stop` + `SubagentStop` hooks in `.claude/settings.json` (parse the session transcript) | **Actual** model from the transcript |
| **GitHub Copilot** | `.github/hooks/agentic-model-logging.json` + logger script | **Intended** (configured) model only — see note |

> **Why Copilot is intended-only:** Copilot's `SubagentStart`/`SubagentStop` hook
> payloads expose the agent *name* and lifecycle but **not** the resolved model,
> and its transcript format is documented as unstable. Asking the model to
> self-report is unreliable (models hallucinate their own identity). So on
> Copilot the logger records the agent's configured model; to see the **actual**
> model, hover the subagent's collapsed tool call in the chat view (it shows the
> model + AI credits) or run **Developer: Show Agent Debug Logs**.

Example `.agentic/logs/model-usage.log`:

```
2026-07-05T23:52:18Z SubagentStop source=actual   model=claude-opus-4-1-20250805 agent=architect session=s1
2026-07-05T23:52:41Z END           source=actual   provider=anthropic model=claude-sonnet-4-5 agent=qa session=abc
2026-07-05T23:53:02Z SubagentStop source=intended model=Claude Opus 4.8 (copilot) agent=architect session=s1 note="actual model: hover the subagent in chat for model+credits"
```

Disable with `agentic-sdlc init --no-model-logging` (persisted as
`"modelLogging": false` in `.agentic-sdlc.json`).

---

## Deterministic skills

Integrations that should not be left to the model run as scripts and emit TOON:

```bash
agentic-sdlc run jira -- --issue FXDOMAIN-1234
agentic-sdlc run jira -- --epic FXDOMAIN-1000
agentic-sdlc run confluence -- --id 123456
agentic-sdlc run figma -- --url "https://www.figma.com/design/KEY/Name?node-id=12-34" --out docs/FXDOMAIN-1234/figma
agentic-sdlc run git-branch -- --type feat --ticket FXDOMAIN-1234 --desc "add retry"
agentic-sdlc run git-commit -- --ticket FXDOMAIN-1234 --message "add retry" --all
agentic-sdlc run context-sync -- --context-dir .agentic/context
agentic-sdlc run cache -- get --key jira:FXDOMAIN-1234 --raw
agentic-sdlc run repo-bridge -- list
agentic-sdlc run graphify -- query "what connects auth to the database?"
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
| `init [-y] [--provider <ids>] [--global] [--no-graphify] [--no-model-logging] [--no-vscode-settings] [--no-gitignore-sdlc]` | Scaffold into the project for the chosen provider(s) |
| `list` / `ls` | List agents and skills with their resolved models per provider |
| `add <skill\|agent> [--model <tier>] [--provider <ids>]` | Add one component |
| `run <skill> -- <args>` | Run a deterministic skill script (emits TOON) |
| `workspace init [-y] [--provider <ids>]` | Mark a folder as a workspace; install workspace agents |
| `workspace list` | List member repos and their install/publish state |
| `workspace sync` | Publish each repo's context into the shared registry |

`--provider` accepts a comma list of `copilot`, `claude`, `opencode`.

---

## Development

### Setup

```bash
git clone <this-repo>
cd agentic-sdlc-cli
npm install
npm run build      # tsc → dist/
npm test            # vitest unit tests
npm run dev -- list   # run straight from src/ via tsx, no build needed
```

`npm run dev -- <args>` runs the CLI directly from TypeScript (`tsx src/index.ts`) —
use it while iterating so you don't have to rebuild after every change. Use
`npm run build && npm run start -- <args>` (or `node dist/index.js <args>`) to test
the compiled output that actually ships (what `npm run prepublishOnly` produces).

Unit tests run with **Vitest** (`npm test`). For behavior-level verification,
still exercise the CLI end to end against a disposable scratch repo as described below.

### PR build/test gate (Node 22)

This repo includes a PR workflow at `.github/workflows/ci.yml` that runs on
pull requests targeting `main` and executes:

1. `npm ci`
2. `npm run build`
3. `npm test`

The release workflow remains on `main` and assumes only validated PRs are merged.
To enforce "merge only after build/tests pass", set branch protection (or a
ruleset) in GitHub to require the `build-and-test` check before merging.

### Testing the CLI locally end to end

Never run `init`/`add`/`workspace init` against this repo itself — always target a
throwaway git repo so you can freely inspect/diff/delete the generated files:

```bash
# 1. build once
npm run build

# 2. make a disposable target repo
rm -rf /tmp/agentic-test && mkdir -p /tmp/agentic-test && cd /tmp/agentic-test && git init -q

# 3a. run against a single provider, non-interactively
node /path/to/agentic-sdlc-cli/dist/index.js init -y -p opencode

# 3b. or run the full interactive prompt flow (docs dir, review loops, output
#     mode, provider checkbox, credentials) exactly as a real user would see it
node /path/to/agentic-sdlc-cli/dist/index.js init

# 4. inspect what was written
ls -R .opencode .github .claude 2>/dev/null
cat .agentic-sdlc.json
cat .gitignore
```

Alternatively, `npm link` puts the CLI on `PATH` as `agentic-sdlc` so you can test
it exactly the way an end user (or the npm `postinstall` hook) would invoke it:

```bash
cd /path/to/agentic-sdlc-cli && npm run build && npm link
cd /tmp/agentic-test && npm link @nvkxt26/agentic-sdlc-cli   # or just: agentic-sdlc init
agentic-sdlc list
agentic-sdlc add mimir --provider claude
agentic-sdlc run context-sync -- --context-dir .agentic/context
```

Things worth exercising after any change to `src/` or `templates/`:

| Area | Command |
|---|---|
| Fresh install, all providers | `init` (interactive) then re-run `init` again to confirm the "overwrite?" prompt and idempotency |
| Fresh install, flags only | `init -y -p copilot,claude,opencode -d docs --global` |
| Single component | `add <agent-or-skill-id> --provider opencode --model reasoning-high` |
| Listing | `list` — confirm every agent/skill in `src/registry.ts` shows up with the right resolved model |
| Deterministic skills | `run git-branch -- --type feat --ticket TEST-1 --desc "try thing"`, `run cache -- set --key k --value v`, etc. — each must emit valid TOON on success **and** on failure (bad args, missing env, not-a-git-repo) |
| Workspace | in a folder containing 2+ git repos: `workspace init`, `workspace list`, `workspace sync` |
| `.gitignore` handling | confirm `.agentic/context`, `.agentic/cache`, `.agentic/registry` (and, if graphify ran, `graphify-out/cost.json`) get appended exactly once, even across repeated `init` runs |

When you change a template body (`templates/**/*.md`), rebuild and re-run `init`/`add`
and check the rendered output under the target repo's provider directories — every
`{{PLACEHOLDER}}` should be substituted (grep the output for a stray `{{` to catch
missed ones).

### Testing the graphify integration

The graphify wiring (`src/graphify.ts`, `templates/skills/graphify/`) is best-effort
and must degrade gracefully whether or not the third-party CLI is present. Test both
paths:

**1. Without the `graphify` CLI installed** (the common case for most contributors):

```bash
which graphify || echo "not installed, good — this is the path most users hit"
cd /tmp/agentic-test && node /path/to/agentic-sdlc-cli/dist/index.js init -y -p opencode
# expect: "graphify not installed ... Install later: uv tool install graphifyy && graphify install"
# and .agentic-sdlc.json should contain "graphify": false

node /path/to/agentic-sdlc-cli/dist/index.js run graphify -- status
node /path/to/agentic-sdlc-cli/dist/index.js run graphify -- query "anything"
# both must print a TOON `error`/`available: false` block and exit non-zero —
# never a stack trace, never a zero exit code
```

**2. With the `graphify` CLI installed** (install once, real network/package call):

```bash
uv tool install graphifyy    # or: pipx install graphifyy / pip install --user graphifyy
graphify --version

cd /tmp/agentic-test
node /path/to/agentic-sdlc-cli/dist/index.js init -y -p opencode
cat .agentic-sdlc.json    # expect "graphify": true
ls graphify-out/              # expect graph.json (+ GRAPH_REPORT.md unless --no-viz suppressed it)

node /path/to/agentic-sdlc-cli/dist/index.js run graphify -- status
node /path/to/agentic-sdlc-cli/dist/index.js run graphify -- build --update
node /path/to/agentic-sdlc-cli/dist/index.js run graphify -- query "what connects the CLI entrypoint to the installer?"
node /path/to/agentic-sdlc-cli/dist/index.js run graphify -- explain "install"
```

**3. Interactive install prompt** — run `init` (no `-y`) with graphify CLI *not*
installed, and confirm you're prompted to install it; answer "no" and confirm the run
still completes cleanly with `"graphify": false`.

**4. Opt-out flag** — `init -y --no-graphify` should skip all graphify detection/setup
entirely, regardless of whether the CLI is installed.

Clean up afterwards:

```bash
rm -rf /tmp/agentic-test
npm unlink -g @nvkxt26/agentic-sdlc-cli   # if you used npm link
uv tool uninstall graphifyy                    # if you installed it just for testing
```

---

## License

[GNU GPL v3](./LICENSE) — free to use, modify, and distribute; any distribution of this software or derivative works must be released under the same GPL v3 terms with source code made available.
