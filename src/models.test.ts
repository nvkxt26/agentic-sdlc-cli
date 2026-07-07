import { describe, expect, it } from 'vitest';
import { MODEL_TIERS, TIER_IDS, modelForTier } from './models.js';

describe('models', () => {
  it('resolves the primary model for a tier', () => {
    expect(modelForTier('balanced')).toBe('GPT-5 mini (copilot)');
  });

  it('exposes all model tier ids', () => {
    expect(TIER_IDS).toEqual(
      expect.arrayContaining(['reasoning-max', 'reasoning-high', 'coding', 'balanced', 'light']),
    );
  });

  it('defines primary and fallback choices for each tier', () => {
    for (const tier of TIER_IDS) {
      expect(MODEL_TIERS[tier].primary).toBeTruthy();
      expect(Array.isArray(MODEL_TIERS[tier].fallbacks)).toBe(true);
    }
  });
});
