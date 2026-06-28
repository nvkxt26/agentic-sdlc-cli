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
