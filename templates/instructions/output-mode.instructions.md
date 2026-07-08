# Output mode

Skills that change source code have two output modes. The default is `{{DEFAULT_OUTPUT_MODE}}`.

## Code comments policy
- Unless the user explicitly asks for comments, do **not** add comments in source code.
- Keep existing comments unless they are incorrect; do not add new explanatory comments by default.

## comments (default)
- Do **not** write the real implementation.
- At each change site, insert a clear comment describing the change: intent, the function/type signature, parameters, return, edge cases, and which requirement it satisfies.
- Use a language-appropriate marker so the sites are greppable, e.g.:
  - JS/TS/Java/C#: `// TODO(agentic): <change>`
  - Python/Shell: `# TODO(agentic): <change>`
  - HTML/XML: `<!-- TODO(agentic): <change> -->`
- The result should compile/parse (placeholders/stubs are fine) but contain no business logic.

## code (override)
- Write complete, idiomatic, building implementation code.
- Enabled when the user or orchestrator passes the `code` override (e.g. `--output code`, or "write the code").

Switching modes affects developer **and** QA stages consistently (tests scaffolded as comments in `comments` mode, full tests in `code` mode).
