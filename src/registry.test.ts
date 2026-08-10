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

describe('registry invariants', () => {
  it('all AGENT ids are unique', () => {
    const ids = AGENTS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all AGENT outFiles are unique', () => {
    const outFiles = AGENTS.map((a) => a.outFile);
    const uniqueOutFiles = new Set(outFiles);
    expect(uniqueOutFiles.size).toBe(outFiles.length);
  });

  it('all PROMPT ids are unique', () => {
    const ids = PROMPTS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all PROMPT outFiles are unique', () => {
    const outFiles = PROMPTS.map((p) => p.outFile);
    const uniqueOutFiles = new Set(outFiles);
    expect(uniqueOutFiles.size).toBe(outFiles.length);
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
    expect(AGENTS.length).toBe(12);
  });

  it('PROMPTS array has expected count', () => {
    expect(PROMPTS.length).toBe(7);
  });
});

describe('resolve-code-scanning registry entries', () => {
  it('code-scanning-remediator agent is registered with correct properties', () => {
    const agent = findAgent('code-scanning-remediator');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Code Scanning Remediator');
    expect(agent?.tier).toBe('reasoning-high');
    expect(agent?.primary).toBe(true);
    expect(agent?.order).toBe(11);
    expect(agent?.template).toBe('agents/code-scanning-remediator.agent.md');
  });

  it('code-scanning-remediator agent has correct capabilities', () => {
    const agent = findAgent('code-scanning-remediator');
    const expectedCaps = ['read', 'search', 'edit', 'run', 'changes', 'todos'];
    expect(agent?.capabilities).toEqual(expectedCaps);
  });

  it('resolve-code-scanning prompt is registered with correct properties', () => {
    const prompt = PROMPTS.find((p) => p.id === 'resolve-code-scanning');
    expect(prompt).toBeDefined();
    expect(prompt?.tier).toBe('reasoning-high');
    expect(prompt?.template).toBe('prompts/resolve-code-scanning.prompt.md');
  });

  it('resolve-code-scanning prompt has correct capabilities', () => {
    const prompt = PROMPTS.find((p) => p.id === 'resolve-code-scanning');
    const expectedCaps = ['read', 'search', 'edit', 'run', 'changes', 'todos'];
    expect(prompt?.capabilities).toEqual(expectedCaps);
  });

  it('AGENTS array has expected count', () => {
    expect(AGENTS.length).toBe(12);
  });

  it('PROMPTS array has expected count', () => {
    expect(PROMPTS.length).toBe(7);
  });
});

describe('dependabot-consolidator registry entries', () => {
  it('dependabot-consolidator agent is registered with correct properties', () => {
    const agent = findAgent('dependabot-consolidator');
    expect(agent).toBeDefined();
    expect(agent?.name).toBe('Dependabot Consolidator');
    expect(agent?.tier).toBe('reasoning-high');
    expect(agent?.primary).toBe(true);
    expect(agent?.order).toBe(11);
    expect(agent?.template).toBe('agents/dependabot-consolidator.agent.md');
  });

  it('dependabot-consolidator agent has correct capabilities (no subagents)', () => {
    const agent = findAgent('dependabot-consolidator');
    const expectedCaps = ['read', 'search', 'edit', 'run', 'changes', 'todos'];
    expect(agent?.capabilities).toEqual(expectedCaps);
    expect(agent?.subagents).toBeUndefined();
  });

  it('consolidate-dependabot prompt is registered with correct properties', () => {
    const prompt = PROMPTS.find((p) => p.id === 'consolidate-dependabot');
    expect(prompt).toBeDefined();
    expect(prompt?.tier).toBe('reasoning-high');
    expect(prompt?.template).toBe('prompts/consolidate-dependabot.prompt.md');
  });

  it('consolidate-dependabot prompt has correct capabilities', () => {
    const prompt = PROMPTS.find((p) => p.id === 'consolidate-dependabot');
    const expectedCaps = ['read', 'search', 'edit', 'run', 'changes', 'todos'];
    expect(prompt?.capabilities).toEqual(expectedCaps);
  });
});
