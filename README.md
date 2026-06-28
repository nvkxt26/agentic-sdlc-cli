# agentic-workflow-cli

An installable **agentic SDLC workflow CLI**. It installs a set of GitHub Copilot
customizations — an orchestrator, persona agents, deterministic skills, and
instruction files — into a target project's `.github/` folder. The agents resolve
a Jira ticket end-to-end and communicate with each other using **TOON**
(Token-Oriented Object Notation) with **caveman FULL** compression.

> Primary target: GitHub Copilot. Designed so other AI agents can be supported later.

## Install

Add it as a project dependency — the customization files are scaffolded into
`.github/` **automatically on install** so Copilot can use them right away:

```bash
npm install --save-dev @nvkxt26/agentic-workflow-cli
```

On install a `postinstall` hook writes the agents, skills, instructions, and
prompts into the host project's `.github/`, plus a `.agentic-workflow.json` config
and a `.env.example`. An existing `.agentic-workflow.json` is preserved (your
docs dir and model overrides are kept); template files are refreshed on upgrade.

> Opt out of auto-scaffolding with `npm install --ignore-scripts`, then run
> `npx agentic-workflow init` manually. Global installs (`-g`) do **not**
> auto-scaffold, since there is no target project.

You can also install the CLI globally to use the commands anywhere:

```bash
npm install -g @nvkxt26/agentic-workflow-cli
# or run without installing:
npx @nvkxt26/agentic-workflow-cli init
```

## Quick start

```bash
# (optional) re-run to configure docs dir, review loops, output mode, credentials
npx agentic-workflow init
npx agentic-workflow list      # show agents + skills and their default models
```

Then in VS Code: open Copilot Chat, select the **SDLC Orchestrator** agent (or run
the `/resolve-ticket` prompt) and give it a Jira ticket id.

## What gets installed (`.github/`)

| Path | Purpose |
| --- | --- |
| `agents/sdlc-orchestrator.agent.md` | Entry point; sequences the personas |
| `agents/product.agent.md` | Gathers Jira + Figma requirements |
| `agents/architect.agent.md` | Produces the implementation plan |
| `agents/senior-developer.agent.md` | Applies the plan (comments by default, or code) |
| `agents/qa.agent.md` | Adds/updates unit + integration tests |
| `agents/code-reviewer.agent.md` | Review loop (up to 5×) until clean |
| `skills/jira/`, `skills/confluence/`, `skills/figma/` | Deterministic fetchers (scripts emit TOON) |
| `skills/git-branch/`, `skills/git-commit/` | Convention-enforcing git helpers |
| `instructions/*.instructions.md` | TOON, caveman, git, docs, no-assume, output-mode rules |
| `prompts/resolve-ticket.prompt.md` | One-shot workflow trigger |

A `.agentic-workflow.json` config and a `.env.example` are written to the project root.

## The SDLC workflow

```
0. setup    → docs/<JIRA>/ + branch (git-branch skill)
1. product  → requirements.toon   (Jira + Figma, asks questions, never assumes)
2. architect→ plan.toon
3. develop  → dev-report.toon      (comments by default; build verified in code mode)
4. qa       → qa-report.toon       (unit + integration tests)
5. review   → review-log.toon      (loop up to 5×)
6. wrap     → commit (git-commit skill) + human summary
```

Every hand-off between stages is a **TOON** artifact persisted under
`docs/<JIRA>/`. Each skill runs **standalone or in-workflow**.

## Models per task (requirement #3)

Each agent/skill maps to a reasoning **tier** that resolves to a VS Code model:

| Tier | Default model | Used by |
| --- | --- | --- |
| `reasoning-max` | Claude Opus 4.8 | orchestrator, architect, code-reviewer |
| `reasoning-high` | Claude Sonnet 4.5 | product |
| `coding` | Claude Sonnet 4.5 | senior-developer, qa |
| `light` | GPT-5 mini | jira, confluence, figma, git-branch, git-commit |

Override per component:

```bash
agentic-workflow add architect --model reasoning-high
```

## Deterministic skills (requirement #4)

Integrations that should not be left to the model run as scripts and emit TOON:

```bash
agentic-workflow run jira -- --issue FXDOMAIN-1234
agentic-workflow run confluence -- --id 123456
agentic-workflow run figma -- --url "https://www.figma.com/design/KEY/Name?node-id=12-34" --out docs/FXDOMAIN-1234/figma
agentic-workflow run git-branch -- --type feat --ticket FXDOMAIN-1234 --desc "add retry"
agentic-workflow run git-commit -- --ticket FXDOMAIN-1234 --message "add retry" --all
```

## Credentials (requirement #5)

`init` asks for the environment variables the skills need and writes any provided
values to a gitignored `.env`:

- `ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` — Jira / Confluence
- `FIGMA_API_TOKEN` — Figma

## Conventions

- **Branch:** `<feat|fix|release|chore>/<JIRA>_<2-3 word desc>` — e.g. `feat/FXDOMAIN-0000_implement-agentic-workflow-cli`
- **Commit:** `[JIRA-TICKET]: <description>`
- **Output mode:** defaults to **comments** marking where code goes; override to **code** to write real implementation.
- **Never assume:** every skill asks numbered questions when requirements are unclear.

## CLI commands

| Command | Description |
| --- | --- |
| `init` | Install the workflow into the current project |
| `list` / `ls` | List agents and skills with their models |
| `add <skill\|agent> [--model <tier>]` | Add one component, optionally overriding its model |
| `run <skill> -- <args>` | Run a deterministic skill script (emits TOON) |

## Development

```bash
npm install
npm run build      # tsc → dist/
npm run dev -- list
```

## License

MIT
