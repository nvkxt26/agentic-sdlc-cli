import { describe, expect, it } from 'vitest';
import { findAgent, findSkill, AGENTS, PROMPTS } from './registry.js';

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

describe('resolve-assigned registry entries', () => {
  it('resolve-assigned agent is registered with correct properties', () => {
    const agent = findAgent('resolve-assigned');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Resolve-Assigned');
    expect(agent?.tier).toBe('reasoning-max');
    expect(agent?.primary).toBe(true);
    expect(agent?.order).toBe(10);
    expect(agent?.template).toBe('agents/resolve-assigned.agent.md');
  });

  it('resolve-assigned agent has correct subagents (NOT sdlc-orchestrator)', () => {
    const agent = findAgent('resolve-assigned');
    expect(agent?.subagents).toEqual([
      'context-builder',
      'product',
      'architect',
      'senior-developer',
      'qa',
      'code-reviewer',
    ]);
    expect(agent?.subagents).not.toContain('sdlc-orchestrator');
  });

  it('resolve-assigned agent has correct capabilities', () => {
    const agent = findAgent('resolve-assigned');
    const expectedCaps = [
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
    ];
    expect(agent?.capabilities).toEqual(expectedCaps);
  });

  it('resolve-assigned prompt is registered with correct properties', () => {
    const prompt = PROMPTS.find((p) => p.id === 'resolve-assigned');
    expect(prompt).toBeDefined();
    expect(prompt?.tier).toBe('reasoning-max');
    expect(prompt?.template).toBe('prompts/resolve-assigned.prompt.md');
  });

  it('resolve-assigned prompt has correct capabilities', () => {
    const prompt = PROMPTS.find((p) => p.id === 'resolve-assigned');
    const expectedCaps = [
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
    ];
    expect(prompt?.capabilities).toEqual(expectedCaps);
  });

  it('AGENTS array has expected count', () => {
    expect(AGENTS.length).toBe(11);
  });

  it('PROMPTS array has expected count', () => {
    expect(PROMPTS.length).toBe(6);
  });
});
