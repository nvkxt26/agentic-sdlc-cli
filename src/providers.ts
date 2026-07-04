import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  MODEL_TIERS,
  CLAUDE_MODEL_TIERS,
  OPENCODE_MODEL_TIERS,
  type ModelChoice,
} from './models.js';
import { vscodeUserDir } from './paths.js';
import type {
  AgentDefinition,
  Capability,
  InstructionDefinition,
  ModelTier,
  ProviderId,
  PromptDefinition,
} from './types.js';

/**
 * A provider adapter. It knows where each logical component lands for a given
 * AI agent, how to name the file, how to build the correct frontmatter, and
 * which concrete model each tier resolves to.
 *
 * The template *bodies* are provider-neutral (placeholders like
 * `{{AGENTS_DIR}}`, `{{MODEL}}`); the provider supplies the frontmatter and the
 * path substitutions so the same body works for Copilot, Claude Code and
 * OpenCode.
 */
export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** Directory (relative to a repo/workspace root) for each component type. */
  agentsDir: string;
  skillsDir: string;
  instructionsDir: string;
  promptsDir: string;
  /** Always-on rules file (relative), e.g. `.github/copilot-instructions.md`. */
  alwaysOnFile: string;
  /** Concrete model per reasoning tier. */
  models: Record<ModelTier, ModelChoice>;
  /** Installed file names. */
  agentFile(id: string): string;
  instructionFile(id: string): string;
  promptFile(id: string): string;
  /** Frontmatter builders (return the full `---\n...\n---\n` block, or ''). */
  agentFrontmatter(a: AgentDefinition, model: string, fallbacks: string[]): string;
  instructionFrontmatter(i: InstructionDefinition): string;
  promptFrontmatter(p: PromptDefinition, model: string, fallbacks: string[]): string;
  /** Absolute global (user-level) install locations. */
  global: {
    agentsDir?: string;
    skillsDir?: string;
    promptsDir?: string;
    instructionsDir?: string;
  };
}

// ---- capability → tool translation ------------------------------------------

const COPILOT_TOOLS: Record<Capability, string[]> = {
  read: ['codebase'],
  search: ['search'],
  edit: ['editFiles'],
  run: ['runCommands', 'runTasks'],
  usages: ['usages'],
  fetch: ['fetch'],
  tests: ['findTestFiles', 'testFailure'],
  changes: ['changes'],
  todos: ['todos'],
  subagents: ['runSubagent'],
};

const CLAUDE_TOOLS: Record<Capability, string[]> = {
  read: ['Read'],
  search: ['Grep', 'Glob'],
  edit: ['Edit', 'Write'],
  run: ['Bash'],
  usages: ['Grep'],
  fetch: ['WebFetch'],
  tests: ['Bash'],
  changes: ['Bash'],
  todos: ['TodoWrite'],
  subagents: ['Task'],
};

const OPENCODE_TOOLS: Record<Capability, string[]> = {
  read: ['read'],
  search: ['grep', 'glob'],
  edit: ['write', 'edit'],
  run: ['bash'],
  usages: ['grep'],
  fetch: ['webfetch'],
  tests: ['bash'],
  changes: ['bash'],
  todos: ['todowrite'],
  subagents: ['task'],
};

function mapTools(caps: Capability[], table: Record<Capability, string[]>): string[] {
  const out = new Set<string>();
  for (const c of caps) for (const t of table[c] ?? []) out.add(t);
  return [...out];
}

// ---- provider specs ---------------------------------------------------------

const copilot: ProviderSpec = {
  id: 'copilot',
  label: 'GitHub Copilot (VS Code)',
  agentsDir: '.github/agents',
  skillsDir: '.github/skills',
  instructionsDir: '.github/instructions',
  promptsDir: '.github/prompts',
  alwaysOnFile: '.github/copilot-instructions.md',
  models: MODEL_TIERS,
  agentFile: (id) => `${id}.agent.md`,
  instructionFile: (id) => `${id}.instructions.md`,
  promptFile: (id) => `${id}.prompt.md`,
  agentFrontmatter(a, model) {
    const tools = mapTools(a.capabilities, COPILOT_TOOLS);
    return [
      '---',
      `description: ${a.description}`,
      `model: ${model}`,
      `tools: [${tools.map((t) => `'${t}'`).join(', ')}]`,
      '---',
      '',
    ].join('\n');
  },
  instructionFrontmatter(i) {
    return ['---', `applyTo: '**'`, `description: ${i.description}`, '---', ''].join('\n');
  },
  promptFrontmatter(p, model) {
    const tools = mapTools(p.capabilities, COPILOT_TOOLS);
    return [
      '---',
      'mode: agent',
      `description: ${p.description}`,
      `model: ${model}`,
      `tools: [${tools.map((t) => `'${t}'`).join(', ')}]`,
      '---',
      '',
    ].join('\n');
  },
  global: {
    // VS Code picks up *.prompt.md and *.instructions.md from the user prompts dir.
    promptsDir: join(vscodeUserDir(), 'prompts'),
    instructionsDir: join(vscodeUserDir(), 'prompts'),
    skillsDir: join(homedir(), '.copilot', 'skills'),
  },
};

const claude: ProviderSpec = {
  id: 'claude',
  label: 'Claude Code',
  agentsDir: '.claude/agents',
  skillsDir: '.claude/skills',
  instructionsDir: '.claude/instructions',
  promptsDir: '.claude/commands',
  alwaysOnFile: 'CLAUDE.md',
  models: CLAUDE_MODEL_TIERS,
  agentFile: (id) => `${id}.md`,
  instructionFile: (id) => `${id}.instructions.md`,
  promptFile: (id) => `${id}.md`,
  agentFrontmatter(a, model) {
    const tools = mapTools(a.capabilities, CLAUDE_TOOLS);
    return [
      '---',
      `name: ${a.id}`,
      `description: ${a.description}`,
      `tools: ${tools.join(', ')}`,
      `model: ${model}`,
      '---',
      '',
    ].join('\n');
  },
  // Claude Code loads these as referenced files from CLAUDE.md; no frontmatter needed.
  instructionFrontmatter() {
    return '';
  },
  promptFrontmatter(p, model) {
    return ['---', `description: ${p.description}`, `model: ${model}`, '---', ''].join('\n');
  },
  global: {
    agentsDir: join(homedir(), '.claude', 'agents'),
    skillsDir: join(homedir(), '.claude', 'skills'),
    promptsDir: join(homedir(), '.claude', 'commands'),
    instructionsDir: join(homedir(), '.claude', 'instructions'),
  },
};

const opencode: ProviderSpec = {
  id: 'opencode',
  label: 'OpenCode',
  agentsDir: '.opencode/agent',
  skillsDir: '.opencode/skills',
  instructionsDir: '.opencode/instructions',
  promptsDir: '.opencode/command',
  alwaysOnFile: 'AGENTS.md',
  models: OPENCODE_MODEL_TIERS,
  agentFile: (id) => `${id}.md`,
  instructionFile: (id) => `${id}.instructions.md`,
  promptFile: (id) => `${id}.md`,
  agentFrontmatter(a, model) {
    const tools = mapTools(a.capabilities, OPENCODE_TOOLS);
    const toolLines = tools.map((t) => `  ${t}: true`).join('\n');
    return [
      '---',
      `description: ${a.description}`,
      `mode: ${a.primary ? 'primary' : 'subagent'}`,
      `model: ${model}`,
      'tools:',
      toolLines,
      '---',
      '',
    ].join('\n');
  },
  instructionFrontmatter() {
    return '';
  },
  promptFrontmatter(p, model) {
    return ['---', `description: ${p.description}`, `model: ${model}`, '---', ''].join('\n');
  },
  global: {
    agentsDir: join(homedir(), '.config', 'opencode', 'agent'),
    skillsDir: join(homedir(), '.config', 'opencode', 'skills'),
    promptsDir: join(homedir(), '.config', 'opencode', 'command'),
    instructionsDir: join(homedir(), '.config', 'opencode', 'instructions'),
  },
};

export const PROVIDERS: Record<ProviderId, ProviderSpec> = { copilot, claude, opencode };

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function getProvider(id: ProviderId): ProviderSpec {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider "${id}". Valid: ${PROVIDER_IDS.join(', ')}`);
  return p;
}

export function isProviderId(v: string): v is ProviderId {
  return (PROVIDER_IDS as string[]).includes(v);
}
