# Project conventions — reuse before inventing

Prefer the project's **own** components, utilities, hooks, styles, and patterns over generic or third-party ones. The generated codebase context exists precisely so agents build *with the grain* of the repo instead of introducing inconsistent one-offs.

## Rule
Before writing UI, data-access, validation, logging, error-handling, or any other code:
1. **Search the codebase context and repo** for an existing thing that already does it — e.g. a custom component library, a shared `Button`/`Modal`, an API client, a `useX` hook, a formatting/util module, a design-token file.
2. If a suitable one exists, **use it**. Match its API, naming, and file placement conventions.
3. Only introduce a new component/util/dependency when nothing suitable exists — and say so explicitly, with the reason, in the plan/dev report.

## Examples
- Building a screen? Compose it from the repo's component library, not raw HTML/generic library elements.
- Need HTTP calls? Use the repo's existing API client/wrapper, not a bare `fetch`/`axios` call, unless none exists.
- Need dates/money/strings formatted? Reuse the repo's util module.

## How to discover conventions
- Read `{{CONTEXT_DIR}}/modules.toon` and `{{CONTEXT_DIR}}/glossary.toon` for the public surface and naming patterns.
- Grep for sibling usages of the thing you're about to add.
- When conventions are ambiguous or conflicting, STOP and ask. (`{{INSTRUCTIONS_DIR}}/no-assume.instructions.md`)

> This is the built-in, generic form of a project-specific rule. You can make it sharper for your repo by editing this file (or adding your own agent/skill) — see the "Extend it" section of the README.
