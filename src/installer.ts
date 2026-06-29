import { mkdir, readFile, writeFile, readdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
  return content
    .replaceAll('{{MODEL}}', choice.primary)
    .replaceAll('{{MODEL_FALLBACKS}}', choice.fallbacks.join(', '))
    .replaceAll('{{TIER}}', vars.tier)
    .replaceAll('{{DOCS_DIR}}', vars.config.docsDir)
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

  return { written };
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

/** Write a .env.example listing every env var the install needs. */
export async function writeEnvExample(
  cwd: string,
  envVars: string[],
  written: string[],
): Promise<void> {
  const lines = [
    '# Environment variables for agentic-workflow deterministic skills.',
    '# Copy to .env (gitignored) and fill in real values.',
    '',
    ...envVars.map((v) => `${v}=`),
    '',
  ];
  const dest = join(cwd, '.env.example');
  await writeFile(dest, lines.join('\n'), 'utf8');
  written.push(dest);
}
