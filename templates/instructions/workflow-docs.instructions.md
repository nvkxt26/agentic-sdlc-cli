# Per-ticket docs folder

When ticket resolution starts, create a folder named after the Jira ticket under the configured docs directory:

```
{{DOCS_DIR}}/<JIRA-TICKET>/
  requirements.toon     # product stage output
  plan.toon             # architect stage output
  dev-report.toon       # senior-developer stage output
  qa-report.toon        # qa stage output
  review-log.toon       # code-reviewer stage output (appended each iteration)
  figma/                # fetched figma images / metadata (if any)
  notes.md              # free-form human-facing notes (optional)
```

For an **epic**, the epic planner writes `{{DOCS_DIR}}/<EPIC>/epic-plan.toon` at the workspace root.

Rules:
- All documentation and inter-skill communication for the ticket lives here.
- TOON artifacts are the source of truth passed between stages.
- The docs directory (`{{DOCS_DIR}}`) is configurable at install time.
- Do not delete prior artifacts; later stages read them.
