# Add a custom instruction / skill / agent / prompt

Scaffold a new workflow customization for **this repo** (or workspace/global). Use this when the user wants their own rule, deterministic tool, persona, or command. State the kind and the goal as the argument (e.g. "skill that generates a changelog from commits", "instruction to always use our design tokens").

## What to do

Act as the **customization author**. Never assume — if the kind, name, scope, or behavior is unclear, STOP and ask concise numbered questions before writing anything. (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`)

### 1. Classify the request
Pick exactly one kind. If ambiguous, ask.

| Kind | Use when | Lands in | File shape |
|---|---|---|---|
| **instruction** | an always-on rule/convention | `{{INSTRUCTIONS_DIR}}/<name>.instructions.md` | frontmatter `applyTo`,`description` + Markdown body |
| **skill** | a deterministic tool or repeatable recipe | `{{SKILLS_DIR}}/<name>/SKILL.md` (+ `scripts/<name>.mjs`) | frontmatter `name`,`description` + body |
| **agent** | a persona / mode with its own model+tools | `{{AGENTS_DIR}}/<name>.agent.md` | provider frontmatter + Markdown body |
| **prompt** | a reusable slash-command | `{{PROMPTS_DIR}}/<name>.prompt.md` | Markdown body (title + steps) |

### 2. Gather the minimum spec (ask if missing)
- **name** — `kebab-case`, unique in its folder.
- **description** — one precise line (this is what the agent auto-matches on; be specific).
- **scope** — repo (default) · workspace root · global (`--global`).
- kind-specific:
  - instruction → `applyTo` glob (default `'**'`) and the rule body.
  - skill → is it **deterministic** (needs a `scripts/<name>.mjs`) or a **recipe** (SKILL.md only)? Inputs, outputs, run command.
  - agent → model tier, allowed tools, the persona's mission + boundaries.
  - prompt → the argument it takes and the ordered steps it runs.

### 3. Write the file(s)
Follow the shipped examples as templates — copy the frontmatter shape of an existing sibling in the same folder so discovery works.

- **Deterministic skill scripts** must be **zero-dependency** ESM (`node:*` only), accept `--flags` from `process.argv`, print **TOON** on stdout on success, and print `error:\n  message: <text>` + non-zero exit on failure. Copy the tiny TOON encoder from any shipped skill (e.g. `{{SKILLS_DIR}}/toon-to-md/scripts/toon-to-md.mjs`). Keep it **idempotent**.
- **Instructions / prompts / agents** are prose. Keep hand-off artifacts TOON, but human-facing text normal prose. Reference other files by their `{{INSTRUCTIONS_DIR}}/…` path so links resolve across providers.
- Respect always-on rules: never-assume, TOON+caveman for hand-offs, git conventions, code-comment hygiene.

### 4. (Skills only) make it invokable
A skill runs via `agentic-sdlc run <name> -- <args>`. If it should be a first-class registered skill (shows in `list`, installs for every provider), add a `SkillDefinition` to `src/registry.ts` `SKILLS` and re-run `init`/`add`. A repo-local skill folder works without registration — it just isn't rendered into the other providers.

### 5. Verify
- Deterministic script: run it once with sample input; confirm it prints valid TOON and exits 0, and a failure path prints an `error:` block with non-zero exit.
- Instruction/agent/prompt: confirm frontmatter parses and the file is in the folder the provider auto-discovers.
- Report what was created (paths), how to invoke it, and any follow-up (e.g. "re-run `init` to render for Claude/OpenCode").

### 6. (Optional) offer to make it reusable
If the new thing is generally useful, offer to add it as a template under `templates/` + a registry entry so it ships to every install — per the self-improve rule (`{{INSTRUCTIONS_DIR}}/self-improve.instructions.md`). Only do this if the user confirms.

Finish with a short **plain-prose** summary: kind, name, path(s), invocation, scope.
