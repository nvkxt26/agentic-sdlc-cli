import { mkdir, readFile, writeFile, readdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { templatesDir } from './paths.js';
import {
  COPILOT_AGENTIC_SDLC_AGENTS_DIR,
  COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR,
  COPILOT_AGENTIC_SDLC_PROMPTS_DIR,
  COPILOT_AGENTIC_SDLC_SKILLS_DIR,
  getProvider,
  type ProviderSpec,
} from './providers.js';
import { AGENTS, SKILLS, INSTRUCTIONS, PROMPTS } from './registry.js';
import { installModelLogging } from './modelLogging.js';
import type {
  AgenticConfig,
  ModelTier,
  AgentDefinition,
  SkillDefinition,
  InstructionDefinition,
  PromptDefinition,
} from './types.js';

export interface InstallOptions {
  cwd: string;
  config: AgenticConfig;
  /** Restrict install to these skill ids; undefined = all. */
  onlySkills?: string[];
  /** Restrict install to these agent ids; undefined = all. */
  onlyAgents?: string[];
  /** Skip instructions/prompts (used by `add`). */
  coreOnly?: boolean;
}

export interface InstallResult {
  written: string[];
}

const DEFAULT_CONTEXT_DIR = '.agentic/context';
const DEFAULT_CACHE_DIR = '.agentic/cache';
const DEFAULT_REGISTRY_DIR = '.agentic/registry';
const LOGS_DIR = '.agentic/logs';

/** Resolve the effective tier for a component, honouring config overrides. */
export function effectiveTier(id: string, fallback: ModelTier, config: AgenticConfig): ModelTier {
  return config.modelOverrides[id] ?? fallback;
}

/** Substitute template placeholders (paths are provider-specific). */
function render(
  content: string,
  vars: { tier: ModelTier; config: AgenticConfig; provider: ProviderSpec },
): string {
  const { config, provider } = vars;
  const choice = provider.models[vars.tier];
  const contextDir = config.contextDir ?? DEFAULT_CONTEXT_DIR;
  const cacheDir = config.cacheDir ?? DEFAULT_CACHE_DIR;
  const registryDir = config.registryDir ?? DEFAULT_REGISTRY_DIR;
  return content
    .replaceAll('{{MODEL}}', choice.primary)
    .replaceAll('{{MODEL_FALLBACKS}}', choice.fallbacks.join(', '))
    .replaceAll('{{TIER}}', vars.tier)
    .replaceAll('{{DOCS_DIR}}', config.docsDir)
    .replaceAll('{{CONTEXT_DIR}}', contextDir)
    .replaceAll('{{CACHE_DIR}}', cacheDir)
    .replaceAll('{{REGISTRY_DIR}}', registryDir)
    .replaceAll('{{REVIEW_LOOPS}}', String(config.reviewLoops))
    .replaceAll('{{DEFAULT_OUTPUT_MODE}}', config.defaultOutputMode)
    .replaceAll('{{AGENTS_DIR}}', provider.agentsDir)
    .replaceAll('{{SKILLS_DIR}}', provider.skillsDir)
    .replaceAll('{{INSTRUCTIONS_DIR}}', provider.instructionsDir)
    .replaceAll('{{PROMPTS_DIR}}', provider.promptsDir)
    .replaceAll('{{ALWAYS_ON_FILE}}', provider.alwaysOnFile)
    .replaceAll('{{PROVIDER}}', provider.label);
}

async function writeOut(dest: string, content: string, written: string[]): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, content, 'utf8');
  written.push(dest);
}

async function installAgent(
  agent: AgentDefinition,
  destDir: string,
  provider: ProviderSpec,
  config: AgenticConfig,
  written: string[],
): Promise<void> {
  const tier = effectiveTier(agent.id, agent.tier, config);
  const choice = provider.models[tier];
  const body = await readFile(join(templatesDir(), agent.template), 'utf8');
  const front = provider.agentFrontmatter(agent, choice.primary, choice.fallbacks);
  const dest = join(destDir, provider.agentFile(agent.outFile));
  await writeOut(dest, front + render(body, { tier, config, provider }), written);
}

async function installInstruction(
  ins: InstructionDefinition,
  destDir: string,
  provider: ProviderSpec,
  config: AgenticConfig,
  written: string[],
): Promise<void> {
  const body = await readFile(join(templatesDir(), ins.template), 'utf8');
  const front = provider.instructionFrontmatter(ins);
  const dest = join(destDir, provider.instructionFile(ins.outFile));
  await writeOut(dest, front + render(body, { tier: 'balanced', config, provider }), written);
}

async function installPrompt(
  p: PromptDefinition,
  destDir: string,
  provider: ProviderSpec,
  config: AgenticConfig,
  written: string[],
): Promise<void> {
  const tier = effectiveTier(p.id, p.tier, config);
  const choice = provider.models[tier];
  const body = await readFile(join(templatesDir(), p.template), 'utf8');
  const front = provider.promptFrontmatter(p, choice.primary, choice.fallbacks);
  const dest = join(destDir, provider.promptFile(p.outFile));
  await writeOut(dest, front + render(body, { tier, config, provider }), written);
}

async function installSkill(
  skill: SkillDefinition,
  destDir: string,
  provider: ProviderSpec,
  config: AgenticConfig,
  written: string[],
): Promise<void> {
  const tier = effectiveTier(skill.id, skill.tier, config);
  const srcDir = join(templatesDir(), 'skills', skill.templateDir);
  const skillDir = join(destDir, skill.id);

  // SKILL.md keeps its own (provider-neutral) name/description frontmatter.
  const md = await readFile(join(srcDir, 'SKILL.md'), 'utf8');
  await writeOut(join(skillDir, 'SKILL.md'), render(md, { tier, config, provider }), written);

  // scripts copied verbatim, made executable.
  const scriptsSrc = join(srcDir, 'scripts');
  if (existsSync(scriptsSrc)) {
    const files = await readdir(scriptsSrc);
    for (const f of files) {
      const raw = await readFile(join(scriptsSrc, f), 'utf8');
      const out = join(skillDir, 'scripts', f);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, raw, 'utf8');
      if (f.endsWith('.mjs')) await chmod(out, 0o755);
      written.push(out);
    }
  }
}

/** Install all selected components for a single provider into `root`. */
async function installForProvider(
  provider: ProviderSpec,
  root: string,
  opts: InstallOptions,
  written: string[],
): Promise<void> {
  const agents = opts.onlyAgents ? AGENTS.filter((a) => opts.onlyAgents!.includes(a.id)) : AGENTS;
  for (const a of agents) {
    await installAgent(a, join(root, provider.agentsDir), provider, opts.config, written);
  }

  const skills = opts.onlySkills ? SKILLS.filter((s) => opts.onlySkills!.includes(s.id)) : SKILLS;
  for (const s of skills) {
    await installSkill(s, join(root, provider.skillsDir), provider, opts.config, written);
  }

  if (!opts.coreOnly) {
    for (const ins of INSTRUCTIONS) {
      await installInstruction(ins, join(root, provider.instructionsDir), provider, opts.config, written);
    }
    for (const p of PROMPTS) {
      await installPrompt(p, join(root, provider.promptsDir), provider, opts.config, written);
    }
    // Always-on entrypoint (rendered body, no frontmatter).
    const entry = await readFile(join(templatesDir(), 'copilot-instructions.md'), 'utf8');
    await writeOut(
      join(root, provider.alwaysOnFile),
      render(entry, { tier: 'balanced', config: opts.config, provider }),
      written,
    );
  }
}

export async function install(opts: InstallOptions): Promise<InstallResult> {
  const written: string[] = [];
  const providers = opts.config.providers?.length ? opts.config.providers : ['copilot' as const];

  for (const pid of providers) {
    await installForProvider(getProvider(pid), opts.cwd, opts, written);
  }

  // Per-provider model-usage logging (full install only, not `add`).
  const modelLoggingOn = !opts.coreOnly && opts.config.modelLogging !== false;
  if (modelLoggingOn) {
    for (const pid of providers) {
      await installModelLogging(pid, opts.cwd, written);
    }
  }

  // Ensure generated context/cache/registry/log dirs are git-ignored (regenerable state).
  const ignoreDirs = [
    opts.config.contextDir ?? DEFAULT_CONTEXT_DIR,
    opts.config.cacheDir ?? DEFAULT_CACHE_DIR,
    opts.config.registryDir ?? DEFAULT_REGISTRY_DIR,
  ];
  if (opts.config.gitignoreSdlc !== false && providers.includes('copilot')) {
    ignoreDirs.push(
      COPILOT_AGENTIC_SDLC_AGENTS_DIR,
      COPILOT_AGENTIC_SDLC_PROMPTS_DIR,
      COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR,
      COPILOT_AGENTIC_SDLC_SKILLS_DIR,
      '.vscode/settings.json',
    );
  }
  if (modelLoggingOn) ignoreDirs.push(LOGS_DIR);
  await ensureGitignore(opts.cwd, ignoreDirs, written);

  return { written };
}

/**
 * Append managed entries to the target project's `.gitignore` so generated
 * codebase context and the token-saving cache are never committed. Entries
 * already present (in any form) are skipped; the block is created on demand.
 */
export async function ensureGitignore(
  cwd: string,
  entries: string[],
  written: string[],
): Promise<void> {
  const path = join(cwd, '.gitignore');
  let body = existsSync(path) ? await readFile(path, 'utf8') : '';
  const present = new Set(
    body
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\/$/, '')),
  );
  const missing = entries
    .map((e) => e.replace(/\/$/, ''))
    .filter((e) => e && !present.has(e));
  if (missing.length === 0) return;

  const MARKER = '# agentic-sdlc (generated context + cache + registry)';
  if (body.length > 0 && !body.endsWith('\n')) body += '\n';
  if (!body.includes(MARKER)) body += `\n${MARKER}\n`;
  for (const e of missing) body += `${e}/\n`;

  await writeFile(path, body, 'utf8');
  written.push(path);
}

export interface GlobalInstallResult {
  written: string[];
}

/**
 * Install components to each configured provider's user-level (global)
 * locations so they are available in every project without a per-repo folder.
 * Only the global sub-directories a provider actually defines are populated.
 */
export async function installGlobal(config: AgenticConfig): Promise<GlobalInstallResult> {
  const written: string[] = [];
  const providers = config.providers?.length ? config.providers : (['copilot'] as const);

  for (const pid of providers) {
    const provider = getProvider(pid);
    const g = provider.global;

    if (g.agentsDir) {
      for (const a of AGENTS) await installAgent(a, g.agentsDir, provider, config, written);
    }
    if (g.promptsDir) {
      for (const p of PROMPTS) await installPrompt(p, g.promptsDir, provider, config, written);
    }
    if (g.instructionsDir) {
      for (const ins of INSTRUCTIONS) {
        await installInstruction(ins, g.instructionsDir, provider, config, written);
      }
    }
    if (g.skillsDir) {
      for (const s of SKILLS) await installSkill(s, g.skillsDir, provider, config, written);
    }
  }

  return { written };
}

/**
 * Detect the user's shell profile file path.
 * Returns an empty string on Windows (handled separately by the caller).
 */
export function shellProfilePath(): string {
  if (process.platform === 'win32') return '';
  const home = homedir();
  const shell = process.env['SHELL'] ?? '';
  if (shell.endsWith('zsh')) return join(home, '.zshrc');
  if (shell.endsWith('bash')) {
    return process.platform === 'darwin'
      ? join(home, '.bash_profile')
      : join(home, '.bashrc');
  }
  return join(home, '.profile');
}

/**
 * Write or update `export VAR="value"` lines in the user's shell profile.
 * Existing entries are updated in-place; new entries are appended.
 * Returns the profile path that was written.
 */
export async function setGlobalEnvVars(
  vars: Record<string, string>,
): Promise<{ profilePath: string }> {
  const profilePath = shellProfilePath();
  let body = existsSync(profilePath) ? await readFile(profilePath, 'utf8') : '';
  if (body.length > 0 && !body.endsWith('\n')) body += '\n';

  for (const [key, value] of Object.entries(vars)) {
    // JSON.stringify gives us correct double-quote escaping (\" for quotes, \\ for backslashes).
    const safe = JSON.stringify(value).slice(1, -1);
    const exportLine = `export ${key}="${safe}"`;
    const regex = new RegExp(`^export ${key}=.*$`, 'm');
    if (regex.test(body)) {
      body = body.replace(regex, exportLine);
    } else {
      body += `${exportLine}\n`;
    }
  }

  await writeFile(profilePath, body, 'utf8');
  return { profilePath };
}

/** Write a .env.example listing every env var the install needs. */
export async function writeEnvExample(
  cwd: string,
  envVars: string[],
  written: string[],
): Promise<void> {
  const profile =
    process.platform === 'win32' ? '$PROFILE (PowerShell)' : shellProfilePath() || '~/.profile';
  const lines = [
    '# Environment variables required by agentic-sdlc deterministic skills.',
    `# Add these exports to your shell profile (${profile}):`,
    '#',
    ...envVars.map((v) => `#   export ${v}="your-value-here"`),
    '#',
    '# Or run `npx agentic-sdlc init` to set them interactively.',
    '',
  ];
  const dest = join(cwd, '.env.example');
  await writeFile(dest, lines.join('\n'), 'utf8');
  written.push(dest);
}
