import type {
  AgentDefinition,
  InstructionDefinition,
  PromptDefinition,
  SkillDefinition,
} from './types.js';

/**
 * The SDLC persona agents. The orchestrator (order 0) drives resolution and
 * delegates to the persona agents in workflow order.
 */
export const AGENTS: AgentDefinition[] = [
  {
    id: 'sdlc-orchestrator',
    name: 'SDLC Orchestrator',
    description:
      'Entry point. Starts ticket resolution and routes work through the persona skills in order.',
    tier: 'reasoning-max',
    template: 'agents/sdlc-orchestrator.agent.md',
    outFile: 'sdlc-orchestrator.agent.md',
    order: 0,
  },
  {
    id: 'product',
    name: 'Product Owner',
    description:
      'Gathers Jira task details, fetches Figma images, resolves ambiguity by asking questions. Never assumes.',
    tier: 'reasoning-high',
    template: 'agents/product.agent.md',
    outFile: 'product.agent.md',
    order: 1,
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Turns gathered requirements into a concrete implementation plan.',
    tier: 'reasoning-max',
    template: 'agents/architect.agent.md',
    outFile: 'architect.agent.md',
    order: 2,
  },
  {
    id: 'senior-developer',
    name: 'Senior Developer',
    description:
      'Produces development design (comments by default) or real code, ensures it builds and covers requirements.',
    tier: 'coding',
    template: 'agents/senior-developer.agent.md',
    outFile: 'senior-developer.agent.md',
    order: 3,
  },
  {
    id: 'qa',
    name: 'QA',
    description: 'Adds/updates unit tests and fixes integration tests where supported.',
    tier: 'coding',
    template: 'agents/qa.agent.md',
    outFile: 'qa.agent.md',
    order: 4,
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description:
      'Reviews all dev + QA changes in a loop (up to 5x), feeding comments back until clean.',
    tier: 'reasoning-max',
    template: 'agents/code-reviewer.agent.md',
    outFile: 'code-reviewer.agent.md',
    order: 5,
  },
];

/**
 * Specialized single-task skills. Deterministic integrations (Jira, Confluence,
 * Figma) ship `.mjs` scripts; git skills ship helpers for naming conventions.
 */
export const SKILLS: SkillDefinition[] = [
  {
    id: 'jira',
    name: 'Jira Reader',
    description:
      'Deterministically fetches a Jira issue (fields, description, comments, links) as TOON.',
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
];

/** Cross-cutting instruction files applied to the workspace. */
export const INSTRUCTIONS: InstructionDefinition[] = [
  {
    id: 'toon-communication',
    description: 'All inter-skill input/output uses TOON; caveman FULL always on for it.',
    template: 'instructions/toon-communication.instructions.md',
    outFile: 'toon-communication.instructions.md',
  },
  {
    id: 'caveman',
    description: 'Caveman compression rules (FULL default) used when emitting TOON.',
    template: 'instructions/caveman.instructions.md',
    outFile: 'caveman.instructions.md',
  },
  {
    id: 'git-conventions',
    description: 'Branch and commit message conventions.',
    template: 'instructions/git-conventions.instructions.md',
    outFile: 'git-conventions.instructions.md',
  },
  {
    id: 'workflow-docs',
    description: 'Per-ticket docs/<JIRA> folder layout and artifact storage.',
    template: 'instructions/workflow-docs.instructions.md',
    outFile: 'workflow-docs.instructions.md',
  },
  {
    id: 'no-assume',
    description: 'Never assume — ask questions when requirements are unclear.',
    template: 'instructions/no-assume.instructions.md',
    outFile: 'no-assume.instructions.md',
  },
  {
    id: 'output-mode',
    description: 'Default to writing comments where code goes; override to emit real code.',
    template: 'instructions/output-mode.instructions.md',
    outFile: 'output-mode.instructions.md',
  },
];

/** Prompt entry points. */
export const PROMPTS: PromptDefinition[] = [
  {
    id: 'resolve-ticket',
    description: 'Kick off full SDLC resolution for a Jira ticket.',
    template: 'prompts/resolve-ticket.prompt.md',
    outFile: 'resolve-ticket.prompt.md',
  },
];

export function findSkill(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function findAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id);
}
