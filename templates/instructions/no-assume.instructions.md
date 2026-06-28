---
applyTo: '**'
description: Never assume — ask questions whenever a requirement is unclear.
---

# Never assume (requirement #9)

This rule applies to **every** skill and agent in the workflow.

- If any requirement, acceptance criterion, scope boundary, edge case, or design detail is unclear or missing, **STOP** and ask the user.
- Ask **concise, numbered questions**. Group related questions. Do not bury them in prose.
- Do **not** guess, do not fill gaps with plausible defaults, do not proceed on assumptions.
- Surface ambiguity early — prefer asking before doing work that may be thrown away.
- In TOON artifacts, unresolved items go in an `openQuestions[]` block; a non-empty `openQuestions` pauses the workflow until answered.

Exception: trivial, reversible, clearly-implied choices (e.g. obvious file naming) may proceed, but state the assumption explicitly so the user can correct it.
