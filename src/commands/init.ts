import { join } from 'node:path';
import { input, select, password, confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import { defaultConfig, writeConfig, readConfig } from '../config.js';
import { install, installGlobal, setGlobalEnvVars, shellProfilePath } from '../installer.js';
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

  const written: string[] = [];

  // Install all templates into .github/.
  const result = await install({ cwd, config });
  written.push(...result.written);

  // Persist config.
  await writeConfig(cwd, config);
  written.push(join(cwd, '.agentic-workflow.json'));

  // Global env var setup for deterministic skills (Jira/Confluence/Figma).
  if (!flags.yes) {
    const alreadySet = config.envVars.filter((n) => !!process.env[n]);
    const missing = config.envVars.filter((n) => !process.env[n]);

    if (alreadySet.length > 0) {
      console.log(
        pc.green('\n✓ Already set in environment: ') + pc.dim(alreadySet.join(', ')),
      );
    }

    if (missing.length > 0) {
      console.log(
        pc.dim(
          `\nThe following credentials are not yet in your environment:\n  ${missing.join(', ')}\n` +
            'Enter values to write them to your shell profile (global), or leave blank to skip.\n',
        ),
      );

      const toWrite: Record<string, string> = {};
      for (const name of missing) {
        const isSecret = /TOKEN|SECRET|PASSWORD|KEY/i.test(name);
        const value = isSecret
          ? await password({ message: `${name} (hidden, optional)`, mask: true })
          : await input({ message: `${name} (optional)`, default: '' });
        if (value?.trim()) toWrite[name] = value.trim();
      }

      if (Object.keys(toWrite).length > 0) {
        if (process.platform === 'win32') {
          console.log(pc.dim('\nOn Windows, set environment variables via PowerShell:'));
          for (const [name, value] of Object.entries(toWrite)) {
            console.log(pc.dim(`  [Environment]::SetEnvironmentVariable("${name}", "${value}", "User")`));
          }
        } else {
          const { profilePath } = await setGlobalEnvVars(toWrite);
          console.log(pc.green(`\n✓ Credentials written to ${pc.cyan(profilePath)}`));
          console.log(pc.dim(`  Reload now: source ${profilePath}`));
        }
      } else {
        const profile =
          process.platform === 'win32' ? '$PROFILE (PowerShell)' : (shellProfilePath() || '~/.profile');
        console.log(pc.dim('\nSkipped. To set credentials later, add to ' + profile + ':'));
        for (const name of missing) {
          console.log(pc.dim(`  export ${name}="your-value-here"`));
        }
      }
    }
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


