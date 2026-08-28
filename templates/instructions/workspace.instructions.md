# Working across a group of repos (workspace)

When this repo is part of a **workspace** (a folder grouping several repos, marked by `.agentic-workspace.json`), agents may need to reason about — or coordinate with — sibling repos. Do it through the shared registry and the repo-bridge channel; never reach blindly into another repo's files.

## Shared context registry
- Each repo publishes its generated context to `{{REGISTRY_DIR}}/<repo>/` (git-ignored, at the workspace root).
- Publish after refreshing context:
  ```bash
  agentic-sdlc run repo-bridge -- publish
  ```
- Read peers:
  ```bash
  agentic-sdlc run repo-bridge -- list                 # all repos + manifests
  agentic-sdlc run repo-bridge -- read --repo <name>   # a peer's published context (full)
  agentic-sdlc run repo-bridge -- query --repo <name> --match <term>  # scoped sub-context (only matching rows) — prefer this for narrow questions to save tokens
  ```

## Agent-to-agent questions
When you need something only another repo can answer (does it own a capability? which module? blast radius?), **ask its Mimir agent** rather than guessing:
```bash
agentic-sdlc run repo-bridge -- ask --repo <name> --question "..."   # post
agentic-sdlc run repo-bridge -- answers --id <questionId>            # read reply
```
On the answering side, a repo's **mimir** agent watches its inbox:
```bash
agentic-sdlc run repo-bridge -- inbox
agentic-sdlc run repo-bridge -- answer --id <questionId> --file <answer.toon>
```

## Rules
- **Never assume** peer internals — read published context or ask. (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`)
- Keep this repo's context **published and fresh** so peers plan against reality.
- All cross-repo answers are **TOON**, caveman FULL. (`{{INSTRUCTIONS_DIR}}/toon-communication.instructions.md`)
- A ticket may require changes in several repos; resolve each in its own repo with its own branch/commit conventions.
