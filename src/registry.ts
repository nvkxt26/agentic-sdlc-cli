import type {
  AgentDefinition,
  InstructionDefinition,
  PromptDefinition,
  SkillDefinition,
} from './types.js';

/**
 * The SDLC persona agents. The orchestrator (order 0) drives resolution and
 * delegates to the persona agents in workflow order. Two workspace-aware agents
 * (mimir, epic-planner) support cross-repo questions and epic planning.
 */
export const AGENTS: AgentDefinition[] = [
  {
    id: 'sdlc-orchestrator',
    name: 'SDLC Orchestrator',
    description:
      'Entry point. Starts ticket resolution and routes work through the persona skills in order.',
    // NOTE: pinned to reasoning-max (not the "balanced" this agent's own
    // sequencing work would need) as a deliberate cost-ceiling workaround for
    // GitHub Copilot: Copilot caps a subagent's requested model at the cost
    // tier of the *invoking* agent's own model — a cheaper orchestrator would
    // silently downgrade every persona it delegates to (architect, reviewer,
    // etc.) to its own tier. Claude Code/OpenCode don't have this constraint,
    // but the tier is shared across providers for one consistent config.
    tier: 'reasoning-max',
    capabilities: [
      'read',
      'search',
      'edit',
      'run',
      'usages',
      'changes',
      'tests',
      'fetch',
      'todos',
      'subagents',
    ],
    template: 'agents/sdlc-orchestrator.agent.md',
    outFile: 'sdlc-orchestrator',
    order: 0,
    primary: true,
    subagents: [
      'product',
      'context-builder',
      'architect',
      'plan-flowchart',
      'senior-developer',
      'qa',
      'code-reviewer',
    ],
  },
  {
    id: 'product',
    name: 'Product Owner',
    description:
      'Gathers Jira task details, fetches Figma images, resolves ambiguity by asking questions. Never assumes.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'fetch', 'edit', 'run'],
    template: 'agents/product.agent.md',
    outFile: 'product',
    order: 1,
  },
  {
    id: 'context-builder',
    name: 'Context Builder',
    description:
      'Maintains codebase context on the default branch; updates it from the diff since the last indexed commit.',
    tier: 'balanced',
    capabilities: ['read', 'search', 'usages', 'run', 'edit', 'fetch'],
    template: 'agents/context-builder.agent.md',
    outFile: 'context-builder',
    order: 2,
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Turns gathered requirements into a concrete implementation plan.',
    tier: 'reasoning-max',
    capabilities: ['read', 'search', 'usages', 'fetch', 'edit', 'tests'],
    template: 'agents/architect.agent.md',
    outFile: 'architect',
    order: 3,
  },
  {
    id: 'plan-flowchart',
    name: 'Plan Flowchart',
    description:
      'Creates an optional Mermaid flowchart from plan.toon so humans can inspect the architect\'s implementation path in detail.',
    tier: 'reasoning-high',
    capabilities: ['read', 'edit'],
    template: 'agents/plan-flowchart.agent.md',
    outFile: 'plan-flowchart',
    order: 4,
    primary: true,
  },
  {
    id: 'senior-developer',
    name: 'Senior Developer',
    description:
      'Produces development design (comments by default) or real code, ensures it builds and covers requirements.',
    tier: 'coding',
    capabilities: ['read', 'search', 'usages', 'edit', 'run', 'tests', 'changes'],
    template: 'agents/senior-developer.agent.md',
    outFile: 'senior-developer',
    order: 5,
  },
  {
    id: 'qa',
    name: 'QA',
    description: 'Adds/updates unit tests and fixes integration tests where supported.',
    tier: 'coding',
    capabilities: ['read', 'search', 'usages', 'edit', 'run', 'tests', 'changes'],
    template: 'agents/qa.agent.md',
    outFile: 'qa',
    order: 6,
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description:
      'Reviews all dev + QA changes in a loop (up to 5x), feeding comments back until clean.',
    tier: 'reasoning-max',
    capabilities: ['read', 'search', 'usages', 'edit', 'run', 'tests', 'changes'],
    template: 'agents/code-reviewer.agent.md',
    outFile: 'code-reviewer',
    order: 7,
  },
  {
    id: 'mimir',
    name: 'Mimir',
    description:
      'Answers any question about this repo from generated context, refreshing the context first when it is stale. Also serves questions from agents in other repos via the repo-bridge skill.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'usages', 'run', 'fetch', 'subagents'],
    template: 'agents/mimir.agent.md',
    outFile: 'mimir',
    order: 8,
    primary: true,
    subagents: ['context-builder'],
  },
  {
    id: 'epic-planner',
    name: 'Epic Planner',
    description:
      'Plans a whole Jira epic across a group of repos: fetches epic children, determines which repo each ticket touches (consulting peer repos via repo-bridge + mimir), and emits a per-ticket, per-repo resolution plan.',
    tier: 'reasoning-max',
    // No 'subagents' capability: epic-planner never invokes a local persona as
    // an in-process subagent. It only reaches peer repos out-of-process via
    // the repo-bridge skill ('run') and hands execution off to a separate
    // `/resolve-ticket` session in the target repo.
    capabilities: ['read', 'search', 'usages', 'run', 'fetch', 'edit', 'todos'],
    template: 'agents/epic-planner.agent.md',
    outFile: 'epic-planner',
    order: 9,
    primary: true,
  },
  {
    id: 'resolve-assigned',
    name: 'Resolve-Assigned',
    description:
      'Batch resolution coordinator: fetches all tickets assigned to the current user from a Jira sprint, processes each sequentially through the full SDLC pipeline (context, product, architect, approval, develop, QA, review, commit) with fail-fast on error.',
    tier: 'reasoning-max',
    capabilities: [
      'read',
      'search',
      'edit',
      'run',
      'fetch',
      'usages',
      'changes',
      'tests',
      'todos',
      'subagents',
    ],
    template: 'agents/resolve-assigned.agent.md',
    outFile: 'resolve-assigned',
    order: 10,
    primary: true,
    subagents: [
      'context-builder',
      'product',
      'architect',
      'senior-developer',
      'qa',
      'code-reviewer',
    ],
  },
  {
    id: 'code-scanning-remediator',
    name: 'Code Scanning Remediator',
    description:
      'Prompt-driven workflow: discovers open GitHub code-scanning alerts for a repo, dismisses user-confirmed false positives via gh api, fixes real alerts with code changes, and consolidates the fixes into one PR. Reuses git-branch/git-commit skills.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'edit', 'run', 'changes', 'todos'],
    template: 'agents/code-scanning-remediator.agent.md',
    outFile: 'code-scanning-remediator',
    order: 11,
    primary: true,
  },
  {
    id: 'dependabot-consolidator',
    name: 'Dependabot Consolidator',
    description:
      'Prompt-driven workflow: discovers OPEN Dependabot PRs via gh, consolidates their version bumps into one PR, closes originals, and resolves dependency vulnerabilities via npm audit. Reuses git-branch/git-commit skills.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'edit', 'run', 'changes', 'todos'],
    template: 'agents/dependabot-consolidator.agent.md',
    outFile: 'dependabot-consolidator',
    order: 12,
    primary: true,
  },
];

/**
 * Specialized single-task skills. Deterministic integrations (Jira, Confluence,
 * Figma) ship `.mjs` scripts; git skills ship helpers for naming conventions;
 * repo-bridge is the deterministic cross-repo context channel.
 */
export const SKILLS: SkillDefinition[] = [
  {
    id: 'jira',
    name: 'Jira Reader',
    description:
      'Deterministically fetches a Jira issue — or an epic and its child issues (--epic) — as TOON.',
    tier: 'light',
    templateDir: 'jira',
    scripts: ['scripts/jira.mjs'],
    requiresEnv: ['ATLASSIAN_BASE_URL', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN'],
    standalone: true,
  },
  {
    id: 'confluence',
    name: 'Confluence Reader',
    description: 'Deterministically fetches a Confluence page by id/title as TOON.',
    tier: 'light',
    templateDir: 'confluence',
    scripts: ['scripts/confluence.mjs'],
    requiresEnv: ['ATLASSIAN_BASE_URL', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN'],
    standalone: true,
  },
  {
    id: 'figma',
    name: 'Figma Reader',
    description: 'Fetches Figma node images/metadata from a design link as TOON.',
    tier: 'light',
    templateDir: 'figma',
    scripts: ['scripts/figma.mjs'],
    requiresEnv: ['FIGMA_API_TOKEN'],
    standalone: true,
  },
  {
    id: 'git-branch',
    name: 'Git Branch',
    description:
      'Creates a branch following <feat/fix/release/chore>/<JIRA>_<2-3 word desc>.',
    tier: 'light',
    templateDir: 'git-branch',
    scripts: ['scripts/git-branch.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'git-commit',
    name: 'Git Commit',
    description: 'Commits staged changes with message format `[JIRA-TICKET]: <description>`.',
    tier: 'light',
    templateDir: 'git-commit',
    scripts: ['scripts/git-commit.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'context-sync',
    name: 'Context Sync',
    description:
      'Detects the default branch and emits the file diff since the last indexed context commit (full on first run). Tracks the commit marker.',
    tier: 'light',
    templateDir: 'context-sync',
    scripts: ['scripts/context-sync.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'cache',
    name: 'Cache Store',
    description:
      'SQLite-backed key/value cache (node:sqlite) for context, Jira, Figma and other fetches — reused across stages to save tokens.',
    tier: 'light',
    templateDir: 'cache',
    scripts: ['scripts/cache.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'repo-bridge',
    name: 'Repo Bridge',
    description:
      'Cross-repo context channel: publish this repo\'s context to the shared workspace registry, list/read peer repos\' context, and post/read questions to peer repos (agent-to-agent messaging).',
    tier: 'light',
    templateDir: 'repo-bridge',
    scripts: ['scripts/repo-bridge.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'graphify',
    name: 'Graphify Bridge',
    description:
      'Optional knowledge-graph layer on top of the TOON codebase context: wraps the third-party graphify CLI to build/query a queryable graph of the repo. Degrades gracefully when graphify is not installed.',
    tier: 'light',
    templateDir: 'graphify',
    scripts: ['scripts/graphify.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'no-added-comments',
    name: 'No Added Comments',
    description:
      'Deterministic guard that flags newly-added source-code comment lines in a diff, enforcing the no-new-comments code-style rule.',
    tier: 'light',
    templateDir: 'no-added-comments',
    scripts: ['scripts/no-added-comments.mjs'],
    requiresEnv: [],
    standalone: true,
  },
  {
    id: 'toon-to-md',
    name: 'TOON to Markdown',
    description:
      'Deterministically renders a caveman-FULL TOON artifact into readable Markdown (scalars, objects, primitive arrays, tabular arrays → headings, lists, tables). Structural transform only; does not de-caveman fragments into prose.',
    tier: 'light',
    templateDir: 'toon-to-md',
    scripts: ['scripts/toon-to-md.mjs'],
    requiresEnv: [],
    standalone: true,
  },
];

/** Cross-cutting instruction files applied to the workspace. */
export const INSTRUCTIONS: InstructionDefinition[] = [
  {
    id: 'toon-communication',
    description: 'All inter-skill input/output uses TOON; caveman FULL always on for it.',
    template: 'instructions/toon-communication.instructions.md',
    outFile: 'toon-communication',
  },
  {
    id: 'caveman',
    description: 'Caveman compression rules (FULL default) used when emitting TOON.',
    template: 'instructions/caveman.instructions.md',
    outFile: 'caveman',
  },
  {
    id: 'git-conventions',
    description: 'Branch and commit message conventions.',
    template: 'instructions/git-conventions.instructions.md',
    outFile: 'git-conventions',
  },
  {
    id: 'workflow-docs',
    description: 'Per-ticket docs/<JIRA> folder layout and artifact storage.',
    template: 'instructions/workflow-docs.instructions.md',
    outFile: 'workflow-docs',
  },
  {
    id: 'no-assume',
    description: 'Never assume — ask questions when requirements are unclear.',
    template: 'instructions/no-assume.instructions.md',
    outFile: 'no-assume',
  },
  {
    id: 'output-mode',
    description: 'Default to writing comments where code goes; override to emit real code.',
    template: 'instructions/output-mode.instructions.md',
    outFile: 'output-mode',
  },
  {
    id: 'code-style',
    description:
      'Source code style: never add new comments/docstrings unless the user explicitly asks; keep existing correct comments.',
    template: 'instructions/code-style.instructions.md',
    outFile: 'code-style',
  },
  {
    id: 'caching',
    description: 'Cache context/Jira/Figma fetches in the SQLite store and reuse them to save tokens.',
    template: 'instructions/caching.instructions.md',
    outFile: 'caching',
  },
  {
    id: 'project-conventions',
    description:
      'Prefer existing project components/utilities/patterns discovered in context over generic ones (e.g. reuse a custom component library).',
    template: 'instructions/project-conventions.instructions.md',
    outFile: 'project-conventions',
  },
  {
    id: 'workspace',
    description:
      'Cross-repo rules: consult peer repos via repo-bridge + mimir, keep context published, never assume peer internals.',
    template: 'instructions/workspace.instructions.md',
    outFile: 'workspace',
  },
];

/** Prompt entry points. */
export const PROMPTS: PromptDefinition[] = [
  {
    id: 'resolve-ticket',
    description: 'Kick off full SDLC resolution for a Jira ticket.',
    tier: 'reasoning-max',
    capabilities: [
      'read',
      'search',
      'edit',
      'run',
      'fetch',
      'usages',
      'changes',
      'tests',
      'todos',
      'subagents',
    ],
    template: 'prompts/resolve-ticket.prompt.md',
    outFile: 'resolve-ticket',
  },
  {
    id: 'mimir',
    description: 'Ask any question about this repo; context is refreshed first if stale.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'usages', 'run', 'fetch', 'subagents'],
    template: 'prompts/mimir.prompt.md',
    outFile: 'mimir',
  },
  {
    id: 'plan-epic',
    description: 'Plan a whole Jira epic across a group of repos, targeting each ticket to its repo.',
    tier: 'reasoning-max',
    capabilities: ['read', 'search', 'usages', 'run', 'fetch', 'edit', 'subagents', 'todos'],
    template: 'prompts/plan-epic.prompt.md',
    outFile: 'plan-epic',
  },
  {
    id: 'review-pr',
    description:
      'Critically review a PR against its Jira ticket as a senior developer/architect.',
    tier: 'reasoning-max',
    capabilities: [
      'read',
      'search',
      'usages',
      'run',
      'fetch',
      'changes',
      'subagents',
      'todos',
    ],
    template: 'prompts/review-pr.prompt.md',
    outFile: 'review-pr',
  },
  {
    id: 'add-customization',
    description:
      'Scaffold a new custom instruction, skill, agent, or prompt for this repo/workspace.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'edit', 'run', 'usages'],
    template: 'prompts/add-customization.prompt.md',
    outFile: 'add-customization',
  },
  {
    id: 'resolve-assigned',
    description:
      'Batch-resolve all tickets assigned to the current user from a Jira sprint, sequentially processing each through the full SDLC pipeline.',
    tier: 'reasoning-max',
    capabilities: [
      'read',
      'search',
      'edit',
      'run',
      'fetch',
      'usages',
      'changes',
      'tests',
      'todos',
      'subagents',
    ],
    template: 'prompts/resolve-assigned.prompt.md',
    outFile: 'resolve-assigned',
  },
  {
    id: 'resolve-code-scanning',
    description:
      'Triage a repo\'s open GitHub code-scanning alerts: dismiss confirmed false positives, fix the real ones, and consolidate the fixes into a single PR.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'edit', 'run', 'changes', 'todos'],
    template: 'prompts/resolve-code-scanning.prompt.md',
    outFile: 'resolve-code-scanning',
  },
  {
    id: 'consolidate-dependabot',
    description:
      'Discover open Dependabot PRs, consolidate their version bumps into one PR, close the originals, and resolve dependency vulnerabilities via npm audit.',
    tier: 'reasoning-high',
    capabilities: ['read', 'search', 'edit', 'run', 'changes', 'todos'],
    template: 'prompts/consolidate-dependabot.prompt.md',
    outFile: 'consolidate-dependabot',
  }
];

export function findSkill(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function findAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id);
}
