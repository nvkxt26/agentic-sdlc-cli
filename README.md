# agentic-workflow-cli

![Latest Release](https://img.shields.io/badge/release-v1.3.0-blue)

An installable **agentic SDLC workflow CLI**. It scaffolds a set of GitHub Copilot
customizations — an orchestrator, persona agents, deterministic skills, and
instruction files — into a project's `.github/` folder so Copilot can resolve a
Jira ticket end-to-end. Agents communicate using **TOON** (Token-Oriented Object
Notation) with **caveman FULL** compression.

> Primary target: GitHub Copilot in VS Code. Designed for other AI agents to be
> supported later.

---

## How installation works

The CLI ships pre-built Copilot customization templates. When you run `init` (or
install as a project dependency), it **renders and copies** those templates into
the locations VS Code auto-discovers:

| What | Where it lands | How Copilot finds it |
|---|---|---|
| Always-on instructions | `.github/copilot-instructions.md` | Loaded automatically for every chat |
| Persona agents | `.github/agents/*.agent.md` | Listed in the Copilot Chat agent picker |
| Skills | `.github/skills/{name}/SKILL.md` | Auto-loaded when a task matches the description |
| Instruction rules | `.github/instructions/*.instructions.md` | Applied per `applyTo` glob |
| Reusable prompts | `.github/prompts/*.prompt.md` | Available as `/` slash commands |

All file names and `name` fields in `SKILL.md` frontmatter exactly match the
directory names VS Code requires for auto-discovery — no extra VS Code settings
needed.

### Global install (optional)

Pass `--global` to also copy prompts and instructions to your VS Code user profile
and skills to `~/.copilot/skills/` so they are available in **every project**
without a `.github/` folder:

| What | Global location |
|---|---|
| Prompts + instructions | `~/Library/Application Support/Code/User/prompts/` (macOS) |
| Prompts + instructions | `%APPDATA%\Code\User\prompts\` (Windows) |
| Prompts + instructions | `~/.config/Code/User/prompts/` (Linux) |
| Skills | `~/.copilot/skills/` (all platforms) |

---

## Install

> **Requires Node.js ≥ 22** — the `cache` skill uses Node's built-in `node:sqlite`.

### Option A — Project dependency (recommended)

Copilot files are scaffolded automatically on `npm install` via a `postinstall`
hook:

```bash
npm install --save-dev @nvkxt26/agentic-workflow-cli
```

What happens on install:
1. Agents, skills, instructions, prompts, and the always-on `copilot-instructions.md`
   are written into `.github/`.
2. A `.agentic-workflow.json` config is created in the project root (with defaults).
3. A `.env.example` listing required credentials is written to the project root.
4. On **upgrade**, template files are refreshed and your existing
   `.agentic-workflow.json` (docs dir, model overrides) is preserved.

> Skip auto-scaffolding: `npm install --save-dev --ignore-scripts @nvkxt26/agentic-workflow-cli`
> then run `npx agentic-workflow init` manually.
>
> Global installs (`-g`) do **not** auto-scaffold — there is no target project.

### Option B — Global CLI

```bash
npm install -g @nvkxt26/agentic-workflow-cli
```

Then inside any project:

```bash
agentic-workflow init          # scaffold into .github/ interactively
agentic-workflow init -y       # scaffold with defaults, no prompts
agentic-workflow init --global # scaffold into .github/ AND install globally
```

### Option C — npx (no install)

```bash
npx @nvkxt26/agentic-workflow-cli init
```

### Installing from GitHub Packages

The package is published to GitHub Packages under `@nvkxt26`. Add auth to
`~/.npmrc` first:

```text
@nvkxt26:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Then install normally:

```bash
npm install -g @nvkxt26/agentic-workflow-cli --registry=https://npm.pkg.github.com
```

---

## Quick start

```bash
# 1. Install into your project
npm install --save-dev @nvkxt26/agentic-workflow-cli

# 2. (Optional) Reconfigure — change docs dir, review loops, output mode, credentials
npx agentic-workflow init

# 3. List installed agents + skills and their assigned models
npx agentic-workflow list
```

In VS Code: open **Copilot Chat**, select the **SDLC Orchestrator** agent from the
agent picker (or type `/resolve-ticket`), and provide a Jira ticket ID.

---

## What gets installed

```
.github/
├── copilot-instructions.md          ← always-on entrypoint (loaded every chat)
├── agents/
│   ├── sdlc-orchestrator.agent.md   ← start here; sequences the pipeline
│   ├── context-builder.agent.md     ← maintains codebase context (incremental, diff-based)
│   ├── product.agent.md             ← gathers Jira + Figma requirements
│   ├── architect.agent.md           ← produces the implementation plan (plans against context)
│   ├── senior-developer.agent.md    ← applies the plan (comments or code)
│   ├── qa.agent.md                  ← adds/updates unit + integration tests
│   └── code-reviewer.agent.md       ← review loop (up to 5×) until clean
├── skills/
│   ├── jira/                        ← fetches Jira issue as TOON
│   ├── confluence/                  ← fetches Confluence page as TOON
│   ├── figma/                       ← fetches Figma node images/metadata as TOON
│   ├── git-branch/                  ← creates branches with enforced naming
│   ├── git-commit/                  ← commits with enforced message format
│   ├── context-sync/                ← default-branch diff since last indexed commit
│   └── cache/                       ← SQLite token-saving cache (node:sqlite)
├── instructions/
│   ├── toon-communication.instructions.md
│   ├── caveman.instructions.md
│   ├── git-conventions.instructions.md
│   ├── workflow-docs.instructions.md
│   ├── no-assume.instructions.md
│   ├── output-mode.instructions.md
│   └── caching.instructions.md
└── prompts/
    └── resolve-ticket.prompt.md     ← /resolve-ticket slash command
```

Project root:
```
.agentic-workflow.json   ← config (docs/context/cache dirs, model overrides, review loops)
.env.example             ← credential template (copy to .env and fill in)
.gitignore               ← gains .agentic/context/ + .agentic/cache/ (generated, never committed)
```

---

## The SDLC workflow

```
0. setup    → docs/<JIRA>/ + branch (git-branch skill)
0b. context → refresh .agentic/context/ from default-branch diff (context-builder + context-sync)
1. product  → requirements.toon   (Jira + Figma; asks questions, never assumes)
2. architect→ plan.toon           (plans against generated context; reuses cache)
3. develop  → dev-report.toon     (comments by default; build verified in code mode)
4. qa       → qa-report.toon      (unit + integration tests)
5. review   → review-log.toon     (loop up to 5×)
6. wrap     → commit (git-commit skill) + human summary
```

Every hand-off between stages is a **TOON** artifact persisted under
`docs/<JIRA>/`. Each skill runs standalone or in-workflow.

---

## Codebase context & caching

Two features keep the workflow fast and cheap:

- **Context** — the **context-builder** agent maintains a map of the codebase on the
  default branch (`main`/`develop`/`master`). The deterministic **context-sync** skill
  detects the default branch and emits the file diff since the last indexed commit
  (full list on first run), so context is updated incrementally instead of re-read each
  ticket. Context lives in `.agentic/context/` and the indexed-commit marker in
  `.agentic/context/context-meta.json`.
- **Cache** — the **cache** skill is a SQLite key/value store (Node's built-in
  `node:sqlite`, hence **Node ≥ 22**) at `.agentic/cache/cache.db`. Stages check it
  before fetching/recomputing (Jira, Figma, Confluence, context, plan fragments) and
  store results after, reusing data to save tokens. See `caching.instructions.md`.

Both `.agentic/context/` and `.agentic/cache/` are generated, regenerable state and are
added to the project's `.gitignore` automatically — they are never committed. The
locations are configurable in `.agentic-workflow.json` (`contextDir`, `cacheDir`).

---

## Models per task

Each agent/skill maps to a reasoning **tier** that resolves to a model:

| Tier | Default model | Used by |
|---|---|---|
| `reasoning-max` | Claude Opus 4.8 | architect, code-reviewer |
| `reasoning-high` | Claude Sonnet 4.5 | product |
| `coding` | Claude Sonnet 4.5 | senior-developer, qa |
| `balanced` | GPT-5 mini | orchestrator, context-builder |
| `light` | GPT-5 mini | jira, confluence, figma, git-branch, git-commit, context-sync, cache |

Override per component:

```bash
agentic-workflow add architect --model reasoning-high
```

---

## Deterministic skills

Integrations that should not be left to the model run as scripts and emit TOON:

```bash
agentic-workflow run jira -- --issue FXDOMAIN-1234
agentic-workflow run confluence -- --id 123456
agentic-workflow run figma -- --url "https://www.figma.com/design/KEY/Name?node-id=12-34" --out docs/FXDOMAIN-1234/figma
agentic-workflow run git-branch -- --type feat --ticket FXDOMAIN-1234 --desc "add retry"
agentic-workflow run git-commit -- --ticket FXDOMAIN-1234 --message "add retry" --all
agentic-workflow run context-sync -- --context-dir .agentic/context
agentic-workflow run cache -- get --key jira:FXDOMAIN-1234 --raw
```

---

## Credentials

`init` asks for the environment variables the skills need and writes any provided
values to a gitignored `.env`:

| Variable | Used by |
|---|---|
| `ATLASSIAN_BASE_URL` | Jira, Confluence |
| `ATLASSIAN_EMAIL` | Jira, Confluence |
| `ATLASSIAN_API_TOKEN` | Jira, Confluence |
| `FIGMA_API_TOKEN` | Figma |

---

## Conventions

- **Branch:** `<feat|fix|release|chore>/<JIRA>_<2-3 word desc>`
  e.g. `feat/FXDOMAIN-0001_add-retry-logic`
- **Commit:** `[JIRA-TICKET]: <description>`
- **Output mode:** defaults to **comments** (marks where code goes); set to **code**
  to write real implementation.
- **Never assume:** every agent stops and asks numbered questions when context is
  missing.

---

## CLI reference

| Command | Description |
|---|---|
| `init [-y] [--global]` | Scaffold into `.github/`; `--global` also installs to VS Code user profile |
| `list` / `ls` | List agents and skills with their assigned models |
| `add <skill\|agent> [--model <tier>]` | Add one component, optionally overriding its model |
| `run <skill> -- <args>` | Run a deterministic skill script (emits TOON) |

---

## Development

```bash
npm install
npm run build      # tsc → dist/
npm run dev -- list
```

---

## License

MIT

