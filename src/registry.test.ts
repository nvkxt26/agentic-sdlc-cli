import { describe, expect, it } from 'vitest';
import { findAgent, findSkill } from './registry.js';

describe('registry lookups', () => {
  it('finds known skills and agents by id', () => {
    expect(findSkill('git-branch')?.name).toBe('Git Branch');
    expect(findAgent('sdlc-orchestrator')?.name).toBe('SDLC Orchestrator');
  });

  it('returns undefined for unknown ids', () => {
    expect(findSkill('missing-skill')).toBeUndefined();
    expect(findAgent('missing-agent')).toBeUndefined();
  });
});
