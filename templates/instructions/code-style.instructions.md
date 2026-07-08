# Code style

Rules for any **source code** you write or edit, in either output mode.

## Comments — no new inline explanations; keep docs accurate
Distinguish two kinds of comments:

- **Inline explanatory comments** — line-level notes that explain what the code below does (`//`, single-line `/* */`, `#`, `<!-- -->`). Unless the user **explicitly** asks, do **not** add these. No new "what this does" notes, banner/section headers, or narration on code you write or change.
- **Documentation comments** — docblocks/docstrings that document a function, method, class, or related structure (`/** ... */` JSDoc, doc banners, language docstrings). These are part of the structure's contract. When you add or modify a structure, **add or update its documentation comment** so it accurately reflects the new behaviour, parameters, and return. Do not add doc comments to structures that never had them purely to explain a change.

General:
- **Keep** existing comments unless they are wrong or now inaccurate; update inaccurate docs rather than deleting them.
- Applies in `code` mode. In `comments` mode the `// TODO(agentic): ...` placeholder markers ARE the deliverable — see `{{INSTRUCTIONS_DIR}}/output-mode.instructions.md`.

## Self-check before finishing a code change
- Inspect the diff: added lines must contain no new **inline** explanatory comments unless the user asked.
- For any structure you changed that has a doc comment, confirm the doc still matches the new signature/behaviour.
- The **no-added-comments** skill (`{{SKILLS_DIR}}/no-added-comments/`) automates this: it flags added **inline** comments as violations and reports added **doc** comments informationally (so you can confirm they reflect the change). It is run by the code-reviewer stage.
