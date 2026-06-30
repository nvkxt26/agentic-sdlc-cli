import { mkdir, readFile, writeFile, readdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { templatesDir, GITHUB_DIR, globalPromptsDir, globalSkillsDir } from './paths.js';
import { MODEL_TIERS } from './models.js';
import { AGENTS, SKILLS, INSTRUCTIONS, PROMPTS } from './registry.js';
import type {
  AgenticConfig,
  ModelTier,
  AgentDefinition,
  SkillDefinition,
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

/** Resolve the effective tier for a component, honouring config overrides. */
export function effectiveTier(id: string, fallback: ModelTier, config: AgenticConfig): ModelTier {
  return config.modelOverrides[id] ?? fallback;
}

/** Substitute template placeholders. */
function render(
  content: string,
  vars: { tier: ModelTier; config: AgenticConfig },
): string {
  const choice = MODEL_TIERS[vars.tier];
  const contextDir = vars.config.contextDir ?? '.agentic/context';
  const cacheDir = vars.config.cacheDir ?? '.agentic/cache';
  return content
    .replaceAll('{{MODEL}}', choice.primary)
    .replaceAll('{{MODEL_FALLBACKS}}', choice.fallbacks.join(', '))
    .replaceAll('{{TIER}}', vars.tier)
    .replaceAll('{{DOCS_DIR}}', vars.config.docsDir)
    .replaceAll('{{CONTEXT_DIR}}', contextDir)
    .replaceAll('{{CACHE_DIR}}', cacheDir)
    .replaceAll('{{REVIEW_LOOPS}}', String(vars.config.reviewLoops))
    .replaceAll('{{DEFAULT_OUTPUT_MODE}}', vars.config.defaultOutputMode);
}

async function copyRendered(
  src: string,
  dest: string,
  tier: ModelTier,
  config: AgenticConfig,
  written: string[],
): Promise<void> {
  const raw = await readFile(src, 'utf8');
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, render(raw, { tier, config }), 'utf8');
  written.push(dest);
}

async function installAgent(
  agent: AgentDefinition,
  opts: InstallOptions,
  written: string[],
): Promise<void> {
  const tier = effectiveTier(agent.id, agent.tier, opts.config);
  const src = join(templatesDir(), agent.template);
  const dest = join(opts.cwd, GITHUB_DIR, 'agents', agent.outFile);
  await copyRendered(src, dest, tier, opts.config, written);
}

async function installSkill(
  skill: SkillDefinition,
  opts: InstallOptions,
  written: string[],
): Promise<void> {
  const tier = effectiveTier(skill.id, skill.tier, opts.config);
  const srcDir = join(templatesDir(), 'skills', skill.templateDir);
  const destDir = join(opts.cwd, GITHUB_DIR, 'skills', skill.id);

  // SKILL.md (rendered)
  await copyRendered(
    join(srcDir, 'SKILL.md'),
    join(destDir, 'SKILL.md'),
    tier,
    opts.config,
    written,
  );

  // scripts (copied verbatim, made executable)
  const scriptsSrc = join(srcDir, 'scripts');
  if (existsSync(scriptsSrc)) {
    const files = await readdir(scriptsSrc);
    for (const f of files) {
      const raw = await readFile(join(scriptsSrc, f), 'utf8');
      const out = join(destDir, 'scripts', f);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, raw, 'utf8');
      if (f.endsWith('.mjs')) await chmod(out, 0o755);
      written.push(out);
    }
  }
}

export async function install(opts: InstallOptions): Promise<InstallResult> {
  const written: string[] = [];

  const onlyAgents = opts.onlyAgents;
  const agents = onlyAgents ? AGENTS.filter((a) => onlyAgents.includes(a.id)) : AGENTS;
  for (const a of agents) await installAgent(a, opts, written);

  const onlySkills = opts.onlySkills;
  const skills = onlySkills ? SKILLS.filter((s) => onlySkills.includes(s.id)) : SKILLS;
  for (const s of skills) await installSkill(s, opts, written);

  if (!opts.coreOnly) {
    for (const ins of INSTRUCTIONS) {
      const src = join(templatesDir(), ins.template);
      const dest = join(opts.cwd, GITHUB_DIR, 'instructions', ins.outFile);
      await copyRendered(src, dest, 'balanced', opts.config, written);
    }
    for (const p of PROMPTS) {
      const src = join(templatesDir(), p.template);
      const dest = join(opts.cwd, GITHUB_DIR, 'prompts', p.outFile);
      await copyRendered(src, dest, 'reasoning-max', opts.config, written);
    }
  }

  // Always-on entrypoint — VS Code loads this unconditionally.
  await copyRendered(
    join(templatesDir(), 'copilot-instructions.md'),
    join(opts.cwd, GITHUB_DIR, 'copilot-instructions.md'),
    'balanced',
    opts.config,
    written,
  );

  // Ensure generated context + cache dirs are git-ignored (they are local, regenerable state).
  await ensureGitignore(
    opts.cwd,
    [
      opts.config.contextDir ?? '.agentic/context',
      opts.config.cacheDir ?? '.agentic/cache',
    ],
    written,
  );

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

  const MARKER = '# agentic-workflow (generated context + cache)';
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
 * Copy prompts and instructions to the VS Code user prompts directory, and
 * skills to ~/.copilot/skills/ so Copilot discovers them globally without
 * a project-level .github/ folder.
 *
 * Locations (platform-aware via globalPromptsDir / globalSkillsDir):
 *   macOS   prompts → ~/Library/Application Support/Code/User/prompts/
 *   macOS   skills  → ~/.copilot/skills/
 *   Windows prompts → %APPDATA%\Code\User\prompts\
 *   Linux   prompts → ~/.config/Code/User/prompts/
 */
export async function installGlobal(config: AgenticConfig): Promise<GlobalInstallResult> {
  const written: string[] = [];
  const promptsTarget = globalPromptsDir();
  const skillsTarget = globalSkillsDir();

  // Prompts → VS Code user prompts dir
  for (const p of PROMPTS) {
    const src = join(templatesDir(), p.template);
    const dest = join(promptsTarget, p.outFile);
    await copyRendered(src, dest, 'reasoning-max', config, written);
  }

  // Instructions → VS Code user prompts dir (Copilot picks up .instructions.md from here)
  for (const ins of INSTRUCTIONS) {
    const src = join(templatesDir(), ins.template);
    const dest = join(promptsTarget, ins.outFile);
    await copyRendered(src, dest, 'balanced', config, written);
  }

  // Skills → ~/.copilot/skills/{id}/
  for (const skill of SKILLS) {
    const tier = effectiveTier(skill.id, skill.tier, config);
    const srcDir = join(templatesDir(), 'skills', skill.templateDir);
    const destDir = join(skillsTarget, skill.id);

    await copyRendered(
      join(srcDir, 'SKILL.md'),
      join(destDir, 'SKILL.md'),
      tier,
      config,
      written,
    );

    const scriptsSrc = join(srcDir, 'scripts');
    if (existsSync(scriptsSrc)) {
      const files = await readdir(scriptsSrc);
      for (const f of files) {
        const raw = await readFile(join(scriptsSrc, f), 'utf8');
        const out = join(destDir, 'scripts', f);
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, raw, 'utf8');
        if (f.endsWith('.mjs')) await chmod(out, 0o755);
        written.push(out);
      }
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
    '# Environment variables required by agentic-workflow deterministic skills.',
    `# Add these exports to your shell profile (${profile}):`,
    '#',
    ...envVars.map((v) => `#   export ${v}="your-value-here"`),
    '#',
    '# Or run `npx agentic-workflow init` to set them interactively.',
    '',
  ];
  const dest = join(cwd, '.env.example');
  await writeFile(dest, lines.join('\n'), 'utf8');
  written.push(dest);
}
