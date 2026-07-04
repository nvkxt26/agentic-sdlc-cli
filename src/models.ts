import type { ModelTier } from './types.js';

/**
 * Maps each logical reasoning tier to a concrete VS Code model picker name
 * plus ordered fallbacks. Names use the VS Code chat model picker convention
 * `Model Name (vendor)`.
 *
 * Rationale (requirement #3): tasks are matched to the cheapest model that can
 * do them well — heavy reasoning for architecture/review, light models for
 * deterministic glue like branch/commit naming.
 */
export interface ModelChoice {
  /** Preferred model. */
  primary: string;
  /** Ordered fallbacks if the primary is unavailable in the user's picker. */
  fallbacks: string[];
}

export const MODEL_TIERS: Record<ModelTier, ModelChoice> = {
  // Maximum reasoning — architecture, deep review, ambiguity resolution.
  'reasoning-max': {
    primary: 'Claude Opus 4.8 (copilot)',
    fallbacks: ['Claude Opus 4.1 (copilot)', 'GPT-5 (copilot)', 'o3 (copilot)'],
  },
  // High reasoning — requirements gathering, complex analysis.
  'reasoning-high': {
    primary: 'Claude Sonnet 4.5 (copilot)',
    fallbacks: ['GPT-5 (copilot)', 'Claude Opus 4.8 (copilot)'],
  },
  // Strong coding — implementation, test authoring.
  coding: {
    primary: 'Claude Sonnet 4.5 (copilot)',
    fallbacks: ['GPT-5-Codex (copilot)', 'GPT-5 (copilot)'],
  },
  // Balanced — moderate tasks, summaries.
  balanced: {
    primary: 'GPT-5 mini (copilot)',
    fallbacks: ['Claude Sonnet 4.5 (copilot)', 'GPT-4.1 (copilot)'],
  },
  // Lightest / cheapest — deterministic glue (branch, commit messages).
  light: {
    primary: 'GPT-5 mini (copilot)',
    fallbacks: ['o4-mini (copilot)', 'GPT-4.1 (copilot)'],
  },
};

/**
 * Claude Code model aliases per tier. Claude Code accepts `opus` | `sonnet` |
 * `haiku` | `inherit` or a full model id in an agent/command `model:` field.
 */
export const CLAUDE_MODEL_TIERS: Record<ModelTier, ModelChoice> = {
  'reasoning-max': { primary: 'opus', fallbacks: ['sonnet'] },
  'reasoning-high': { primary: 'sonnet', fallbacks: ['opus'] },
  coding: { primary: 'sonnet', fallbacks: ['haiku'] },
  balanced: { primary: 'sonnet', fallbacks: ['haiku'] },
  light: { primary: 'haiku', fallbacks: ['sonnet'] },
};

/**
 * OpenCode model ids per tier, in `provider/model` form. Defaults target the
 * `anthropic` provider; adjust to your configured provider (e.g.
 * `github-copilot/*`, `openai/*`) in `.agentic-workflow.json` or the agent file.
 */
export const OPENCODE_MODEL_TIERS: Record<ModelTier, ModelChoice> = {
  'reasoning-max': {
    primary: 'anthropic/claude-opus-4-1',
    fallbacks: ['anthropic/claude-sonnet-4-5'],
  },
  'reasoning-high': {
    primary: 'anthropic/claude-sonnet-4-5',
    fallbacks: ['anthropic/claude-opus-4-1'],
  },
  coding: {
    primary: 'anthropic/claude-sonnet-4-5',
    fallbacks: ['anthropic/claude-3-5-haiku-latest'],
  },
  balanced: {
    primary: 'anthropic/claude-sonnet-4-5',
    fallbacks: ['anthropic/claude-3-5-haiku-latest'],
  },
  light: {
    primary: 'anthropic/claude-3-5-haiku-latest',
    fallbacks: ['anthropic/claude-sonnet-4-5'],
  },
};

/** Human-friendly label for a tier, used in `list` output. */
export const TIER_LABEL: Record<ModelTier, string> = {
  'reasoning-max': 'max reasoning',
  'reasoning-high': 'high reasoning',
  coding: 'coding',
  balanced: 'balanced',
  light: 'light',
};

/** Resolve the concrete model name for a tier. */
export function modelForTier(tier: ModelTier): string {
  return MODEL_TIERS[tier].primary;
}

/** All valid tier ids (for CLI validation of --model overrides). */
export const TIER_IDS = Object.keys(MODEL_TIERS) as ModelTier[];
