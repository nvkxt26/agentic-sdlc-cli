# agentic-sdlc-cli

![Latest Release](https://img.shields.io/badge/release-v3.0.0-blue)

An installable **agentic SDLC workflow CLI**. It scaffolds a set of AI-agent
customizations — an orchestrator, persona agents, deterministic skills, and
instruction files — into a project so your coding agent can resolve a Jira ticket
end-to-end. Agents communicate using **TOON** (Token-Oriented Object Notation)
with **caveman FULL** compression.

> **GitHub Copilot** is the primary provider; **Claude Code** is also supported as a
> secondary target. The same logical components are rendered into each provider's
> native layout, frontmatter, and model naming. Pick one or both with `--provider`.

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
- [Development](#development)

---

## Choosing your AI provider

One command, two providers. Choose at install time:

```bash
agentic-sdlc init --provider copilot          # default (primary)
agentic-sdlc init --provider claude
agentic-sdlc init --provider copilot,claude   # scaffold both at once
```

Each provider gets its own native layout, frontmatter, and model names:

| | GitHub Copilot (primary) | Claude Code |
|---|---|---|
| Always-on rules | `.github/copilot-instructions.md` | `CLAUDE.md` |
| Agents | `.github/agentic-sdlc/agents/*.agent.md` | `.claude/agents/*.md` |
| Skills | `.github/agentic-sdlc/skills/<name>/` | `.claude/skills/<name>/` |
| Instructions | `.github/agentic-sdlc/instructions/*.instructions.md` | `.claude/instructions/*.instructions.md` |
| Prompts / commands | `.github/agentic-sdlc/prompts/*.prompt.md` | `.claude/commands/*.md` |
| Model naming | `Claude Opus 4.8 (copilot)` | `opus` / `sonnet` / `haiku` |

The **template bodies are provider-neutral** — the CLI supplies each provider's
frontmatter (tools, mode, model) and rewrites path references. Model names are just
defaults you can change (see [Models per task](#models-per-task)).

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
- `agentic-sdlc run jira|confluence|figma|context-sync|cache|repo-bridge`

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

### Run prompts from the GitHub Copilot chat window

With Copilot installed, the scaffolded prompts are available as slash commands in
the VS Code Copilot Chat input. Type `/` and pick one, then pass its argument:

- `/resolve-ticket FXDOMAIN-1234` — run the full SDLC pipeline for one ticket.
- `/resolve-pr-review 42` — evaluate PR review comments, fix confirmed genuine issues locally, and (with explicit approval) push fixes and mark review threads resolved.
- `/mimir "where is auth handled?"` — ask a grounded question about this repo.
- `/plan-epic FXDOMAIN-1000` — plan an epic across the workspace repos.
- `/resolve-assigned active` — batch-resolve tickets assigned to you in a sprint.

Hand-offs default to **TOON** with **caveman FULL**; append `--no-toon` and/or
`--no-caveman` to a prompt to bypass that formatting for the run (plain Markdown /
normal prose instead). You can also select any persona agent directly from the
agent picker instead of a slash command.

---

## The SDLC workflow

```
0. setup    → docs/<JIRA>/ + branch (git-branch skill)
0b. context → refresh .agentic/context/ from default-branch diff (context-builder + context-sync)
1. product  → requirements.toon   (Jira + Figma; asks questions, never assumes)
2. architect→ plan.toon           (plans against context; reuses existing components; reuses cache)
2b. approve → user approves `plan.toon` before any source edits
3. develop  → dev-report.toon     (real implementation code; build verified)
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
| Senior Developer | Applies the plan as real implementation code |
| QA | Adds/updates unit + integration tests |
| Code Reviewer | Review loop until clean |
| **Mimir** | Answers any question about the repo; refreshes context first when stale |
| **Epic Planner** | Plans a whole epic across a group of repos |

---

## Ask questions about a repo

**Mimir** (prompt `/mimir`) answers any question about the current
repository — "where is auth handled?", "what would change to add SSO?" — grounded in
real code and the generated context. Crucially, it **updates the context beforehand
if it's stale**: it runs the `context-sync` skill, and if the default branch has
moved since the last index, it refreshes via the context-builder before answering.

> In Norse mythology, Mimir is the being Odin himself consults for wisdom — legend has
> it Odin even keeps Mimir's severed, preserved head around specifically to ask it
> questions. Our Mimir only asks for a stale-context refresh in return, which is
> honestly a much better deal.

```
/mimir where are retries configured for the payments client?
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

### Fastest path: the `/add-customization` prompt

Don't want to remember the folder layout and frontmatter? Run the guided prompt and
describe what you want — it classifies the kind, asks for anything missing (never
assumes), writes the file(s) in the right place, and verifies them:

```
/add-customization skill that generates a changelog from the branch's commits
/add-customization instruction to always use our in-house design tokens
/add-customization agent that reviews DB migrations for rollback safety
/add-customization prompt to open a release checklist
```

Prefer to do it by hand? The step-by-step for each kind is below.

### Step-by-step (manual)

1. **Choose the kind** — rule → *instruction*; deterministic tool/recipe → *skill*;
   persona/mode → *agent*; reusable slash-command → *prompt*.
2. **Pick a scope** — repo (its provider folder), workspace (root provider folder), or
   global (`--global`, or the user-level locations above). Discovery layers repo →
   workspace → global.
3. **Name it** `kebab-case` and write a **precise one-line `description`** — that
   description is what the agent auto-matches on, so be specific.
4. **Create the file** in the matching folder (table below), copying the frontmatter
   shape of an existing sibling so discovery works.
5. **(Skills)** add `scripts/<name>.mjs` for deterministic work — zero-dependency ESM,
   reads `--flags`, prints **TOON** on success / `error:` + non-zero exit on failure.
6. **Verify** — run a deterministic skill once (valid TOON, exit 0); for the others
   confirm the frontmatter parses and the file sits in the auto-discovered folder.
7. **(Optional) ship it everywhere** — register it in `src/registry.ts` and re-run
   `init`/`add` to render it for every provider (per the self-improve rule).

| Kind | Copilot folder | File |
|---|---|---|
| instruction | `.github/agentic-sdlc/instructions/` | `<name>.instructions.md` |
| skill | `.github/agentic-sdlc/skills/<name>/` | `SKILL.md` (+ `scripts/<name>.mjs`) |
| agent | `.github/agentic-sdlc/agents/` | `<name>.agent.md` |
| prompt | `.github/agentic-sdlc/prompts/` | `<name>.prompt.md` |

> Claude Code uses `.claude/{instructions,skills,agents,commands}/`. See [Choosing your AI provider](#choosing-your-ai-provider).

### Add an instruction (a rule that's always applied)

Instructions are the simplest way to teach the workflow your project's conventions.

**Example — "use our custom component library instead of generic components":**

Create `.github/agentic-sdlc/instructions/ui-components.instructions.md` (Copilot; use
`.claude/instructions/` for Claude Code):

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

The equivalent **Claude Code** agent uses `name:`/`tools: Read, Grep, …`. See the
installed agents for a copy-paste template per provider.

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

## Models per task

Each agent/skill maps to a reasoning **tier**; each provider resolves the tier to a
concrete model:

| Tier | Copilot | Claude Code |
|---|---|---|
| `reasoning-max` | Claude Opus 4.8 | `opus` |
| `reasoning-high` | Claude Sonnet 4.5 | `sonnet` |
| `coding` | Claude Sonnet 4.5 | `sonnet` |
| `balanced` | GPT-5 mini | `sonnet` |
| `light` | GPT-5 mini | `haiku` |

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
| **Claude Code** | Honored **only** when the persona is invoked as a subagent via the `Task` tool. | `sdlc-orchestrator.agent.md` and `mimir.agent.md` explicitly instruct: delegate by name via the subagent tool, never answer a stage inline. |
| **Copilot** (VS Code + CLI, same `.github/agentic-sdlc/agents/*.agent.md` files) | Subagent model priority is *explicit param → the subagent's own `model:` → the invoking agent's model* — **but a subagent's requested model can never exceed the cost tier of the agent that invoked it**; a cheaper coordinator silently downgrades every subagent it calls. | 1) `model:` is emitted as an **array** (`model: ['Claude Opus 4.8 (copilot)', ...fallbacks]`) so VS Code tries each in order instead of silently falling back to the currently-picked model if the primary is unavailable to the user's plan. 2) The **SDLC Orchestrator** is pinned to `reasoning-max` (not the lighter tier its own sequencing work would need) specifically so it's never the cost ceiling for the personas it delegates to. 3) Subagent-only personas get `user-invocable: false` (hidden from the top-level agent picker). 4) Coordinating agents (`sdlc-orchestrator`, `mimir`) get an `agents:` allowlist naming exactly which personas they may invoke, so Copilot can't pick an unintended similarly-named agent. |

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
agentic-sdlc run toon-to-md -- --file docs/FXDOMAIN-1234/plan.toon --out docs/FXDOMAIN-1234/plan.md
```

### Render a TOON artifact to readable Markdown (`toon-to-md`)

Hand-off artifacts (`requirements.toon`, `plan.toon`, `dev-report.toon`, …) are
written in **caveman-FULL TOON** to save tokens. When you need a human-readable
copy — to paste in a PR, share with a non-engineer, or skim — render it with the
deterministic **toon-to-md** skill:

```bash
# write a sibling .md (prints a TOON status block)
agentic-sdlc run toon-to-md -- --file docs/FXDOMAIN-1234/plan.toon --out docs/FXDOMAIN-1234/plan.md

# quick preview to stdout / pipe
agentic-sdlc run toon-to-md -- --file docs/FXDOMAIN-1234/requirements.toon
cat docs/FXDOMAIN-1234/qa-report.toon | agentic-sdlc run toon-to-md --
```

**Layer 1 (default, deterministic).** A pure 1:1 structural transform — scalars →
bold bullets, nested objects → headings, tabular arrays → aligned tables. Wide or
long-text tables auto-fall back to per-row sections so raw Markdown stays readable.
Force it with `--layout auto|table|sections`. This layer is free and reproducible;
it does **not** rewrite the caveman fragments.

**Layer 2 (optional, lower-tier model).** Caveman is intentionally lossy;
turning fragments back into natural sentences needs a model. This runs as a **guarded
two-phase** flow (`--prose-extract` → model rewrite → `--prose-apply`) so the cheapest
(`light`) tier is safe to use:

```bash
# 1. extract caveman leaf fragments + their protected tokens as TOON (stdout)
agentic-sdlc run toon-to-md -- --file docs/FXDOMAIN-1234/plan.toon --prose-extract > tasks.toon
# 2. a light-tier model rewrites each task into `rewrites[]{id,text}` (identifiers untouched)
# 3. apply — any rewrite that drops a protected token is auto-reverted to the original
agentic-sdlc run toon-to-md -- --file docs/FXDOMAIN-1234/plan.toon --prose-apply rewrites.toon --out plan.md
```

The apply phase deterministically verifies every protected token (identifiers, paths,
`REQ-\d+`, code-ish tokens) survives the rewrite; if a small model mangles one, that
fragment reverts to its original caveman text. Default output stays deterministic —
prose is strictly opt-in.


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
- **Code only:** the developer and QA stages write real implementation code and tests (no comment-only stubs).
- **Formatting:** hand-offs default to **TOON** + **caveman FULL**; bypass per run with `--no-toon` / `--no-caveman`.
- **Never assume:** every agent stops and asks numbered questions when context is missing.
- **Reuse project conventions:** prefer existing components/utilities over generic ones.

---

## CLI reference

| Command | Description |
|---|---|
| `init [-y] [--provider <ids>] [--global] [--no-model-logging] [--no-vscode-settings] [--no-gitignore-sdlc]` | Scaffold into the project for the chosen provider(s) |
| `list` / `ls` | List agents and skills with their resolved models per provider |
| `add <skill\|agent> [--model <tier>] [--provider <ids>]` | Add one component |
| `run <skill> -- <args>` | Run a deterministic skill script (emits TOON) |
| `workspace init [-y] [--provider <ids>]` | Mark a folder as a workspace; install workspace agents |
| `workspace list` | List member repos and their install/publish state |
| `workspace sync` | Publish each repo's context into the shared registry |

`--provider` accepts a comma list of `copilot`, `claude`.

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
node /path/to/agentic-sdlc-cli/dist/index.js init -y -p copilot

# 3b. or run the full interactive prompt flow (docs dir, review loops,
#     provider checkbox, credentials) exactly as a real user would see it
node /path/to/agentic-sdlc-cli/dist/index.js init

# 4. inspect what was written
ls -R .github .claude 2>/dev/null
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
| Fresh install, flags only | `init -y -p copilot,claude -d docs --global` |
| Single component | `add <agent-or-skill-id> --provider claude --model reasoning-high` |
| Listing | `list` — confirm every agent/skill in `src/registry.ts` shows up with the right resolved model |
| Deterministic skills | `run git-branch -- --type feat --ticket TEST-1 --desc "try thing"`, `run cache -- set --key k --value v`, etc. — each must emit valid TOON on success **and** on failure (bad args, missing env, not-a-git-repo) |
| Workspace | in a folder containing 2+ git repos: `workspace init`, `workspace list`, `workspace sync` |
| `.gitignore` handling | confirm `.agentic/context`, `.agentic/cache`, `.agentic/registry` get appended exactly once, even across repeated `init` runs |

When you change a template body (`templates/**/*.md`), rebuild and re-run `init`/`add`
and check the rendered output under the target repo's provider directories — every
`{{PLACEHOLDER}}` should be substituted (grep the output for a stray `{{` to catch
missed ones).

Clean up afterwards:

```bash
rm -rf /tmp/agentic-test
npm unlink -g @nvkxt26/agentic-sdlc-cli   # if you used npm link
```

---

## License

[GNU GPL v3](./LICENSE) — free to use, modify, and distribute; any distribution of this software or derivative works must be released under the same GPL v3 terms with source code made available.
