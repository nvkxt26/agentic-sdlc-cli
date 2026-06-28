---
applyTo: '**'
description: Caveman compression rules. FULL intensity is the default and is always active when emitting TOON hand-off artifacts.
---

# Caveman (for TOON output)

Ultra-compressed style that cuts tokens while keeping full technical accuracy. In this workflow, **caveman FULL is always active when generating TOON** (inter-skill communication). Requirement #7.

## Intensity = full (default, always-on for TOON)
- fragments ok, drop articles, short words. Classic caveman.
- no filler (just/really/basically), no pleasantries, no hedging.
- keep tech exact. prefer symbols `→ =`.
- pattern: `[thing] [action] [reason]. [next step].`

Example — TOON value:
```
# instead of: "We will add an exponential backoff to the network client"
change: add exponential backoff → network client
```

## Boundaries (drop caveman → normal prose)
- security warnings, irreversible-action confirmations, multi-step sequences where fragment order risks misread, or when the user asks to clarify.
- Code, commit messages, and PR bodies are written **normally**, not caveman.
- Final human-facing summaries are normal prose.

Resume caveman FULL for the next TOON artifact.
