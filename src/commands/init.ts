import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { input, select, password, confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import { defaultConfig, writeConfig, readConfig } from '../config.js';
import { install, installGlobal, writeEnvExample } from '../installer.js';
import { globalPromptsDir, globalSkillsDir } from '../paths.js';
import type { AgenticConfig } from '../types.js';

interface InitFlags {
  yes?: boolean;
  docsDir?: string;
  cwd?: string;
  global?: boolean;
}

/** Interactive (or flag-driven) installer. */
export async function initCommand(flags: InitFlags): Promise<void> {
  const cwd = flags.cwd ? join(process.cwd(), flags.cwd) : process.cwd();

  const existing = await readConfig(cwd);
  if (existing && !flags.yes) {
    const overwrite = await confirm({
      message: 'An agentic-workflow config already exists. Reinstall / overwrite templates?',
      default: false,
    });
    if (!overwrite) {
      console.log(pc.yellow('Aborted. Nothing changed.'));
      return;
    }
  }

  const config: AgenticConfig = existing ?? defaultConfig();

  if (!flags.yes) {
    config.docsDir = await input({
      message: 'Where should per-ticket docs folders be created?',
      default: flags.docsDir ?? config.docsDir,
    });

    config.reviewLoops = Number(
      await input({
        message: 'Max code-review loop iterations',
        default: String(config.reviewLoops),
        validate: (v) => (/^\d+$/.test(v) && Number(v) > 0 ? true : 'Enter a positive integer'),
      }),
    );

    config.defaultOutputMode = (await select({
      message: 'Default developer output mode',
      choices: [
        { name: 'comments — mark where code goes (default, safest)', value: 'comments' },
        { name: 'code — write real implementation code', value: 'code' },
      ],
      default: config.defaultOutputMode,
    })) as 'comments' | 'code';
  } else if (flags.docsDir) {
    config.docsDir = flags.docsDir;
  }

  // Collect env var values (requirement #5). Stored in gitignored .env only.
  const envValues: Record<string, string> = {};
  if (!flags.yes) {
    console.log(
      pc.dim(
        '\nProvide credentials for deterministic skills (Jira/Confluence/Figma).\n' +
          'Leave blank to skip — values are written to a gitignored .env, never committed.\n',
      ),
    );
    for (const name of config.envVars) {
      const isSecret = /TOKEN|SECRET|PASSWORD|KEY/i.test(name);
      const value = isSecret
        ? await password({ message: `${name} (hidden, optional)`, mask: true })
        : await input({ message: `${name} (optional)`, default: '' });
      if (value && value.trim()) envValues[name] = value.trim();
    }
  }

  const written: string[] = [];

  // Install all templates into .github/.
  const result = await install({ cwd, config });
  written.push(...result.written);

  // Persist config.
  await writeConfig(cwd, config);
  written.push(join(cwd, '.agentic-workflow.json'));

  // .env.example always; .env only if values were given.
  await writeEnvExample(cwd, config.envVars, written);
  if (Object.keys(envValues).length > 0) {
    const envPath = join(cwd, '.env');
    const body =
      Object.entries(envValues)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n';
    await writeFile(envPath, body, 'utf8');
    written.push(envPath);
    await ensureGitignored(cwd, '.env');
  }

  // Global install: copy prompts/instructions to VS Code user profile and skills to ~/.copilot/skills/
  if (flags.global) {
    const globalResult = await installGlobal(config);
    written.push(...globalResult.written);
  }

  console.log(pc.green(`\n✓ Installed ${written.length} files.`));
  console.log(pc.dim('Key locations:'));
  console.log(`  ${pc.cyan('.github/copilot-instructions.md')}  always-on Copilot entrypoint`);
  console.log(`  ${pc.cyan('.github/agents/')}                  SDLC orchestrator + persona agents`);
  console.log(`  ${pc.cyan('.github/skills/')}                  deterministic skills + scripts`);
  console.log(`  ${pc.cyan('.github/instructions/')}            TOON / caveman / git / docs rules`);
  console.log(`  ${pc.cyan('.github/prompts/')}                 resolve-ticket entry point`);
  console.log(`  ${pc.cyan(config.docsDir + '/')}                       per-ticket artifacts land here`);
  if (flags.global) {
    console.log(pc.dim('\nGlobal install:'));
    console.log(`  ${pc.cyan(globalPromptsDir())}  prompts + instructions`);
    console.log(`  ${pc.cyan(globalSkillsDir())}        skills`);
  }
  console.log(
    pc.dim(
      '\nNext: open Copilot Chat, pick the "SDLC Orchestrator" agent, and run /resolve-ticket.',
    ),
  );
}

async function ensureGitignored(cwd: string, entry: string): Promise<void> {
  const gi = join(cwd, '.gitignore');
  let body = '';
  if (existsSync(gi)) {
    const { readFile } = await import('node:fs/promises');
    body = await readFile(gi, 'utf8');
    if (body.split(/\r?\n/).some((l) => l.trim() === entry)) return;
    if (!body.endsWith('\n')) body += '\n';
  }
  body += `${entry}\n`;
  await writeFile(gi, body, 'utf8');
}
