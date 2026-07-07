import { join } from 'node:path';
import { input, select, password, confirm, checkbox } from '@inquirer/prompts';
import pc from 'picocolors';
import { defaultConfig, writeConfig, readConfig } from '../config.js';
import { install, installGlobal, setGlobalEnvVars, shellProfilePath } from '../installer.js';
import { getProvider, isProviderId, PROVIDER_IDS, PROVIDERS } from '../providers.js';
import {
  isGraphifyInstalled,
  tryInstallGraphifyCli,
  setupGraphifyForProvider,
  buildGraphifyGraph,
  ensureGraphifyGitignore,
  GRAPHIFY_INSTALL_HINT,
} from '../graphify.js';
import { upsertVscodeSettings } from '../vscodeSettings.js';
import type { AgenticConfig, ProviderId } from '../types.js';

interface InitFlags {
  yes?: boolean;
  docsDir?: string;
  cwd?: string;
  global?: boolean;
  provider?: string;
  graphify?: boolean;
  modelLogging?: boolean;
  vscodeSettings?: boolean;
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

  // Model-usage logging is on by default; `--no-model-logging` disables it.
  config.modelLogging = flags.modelLogging !== false;

  // Provider selection ---------------------------------------------------------
  if (flags.provider) {
    const requested = flags.provider.split(',').map((s) => s.trim()).filter(Boolean);
    const invalid = requested.filter((p) => !isProviderId(p));
    if (invalid.length) {
      console.error(
        pc.red(`Invalid --provider ${invalid.join(', ')}. Valid: ${PROVIDER_IDS.join(', ')}`),
      );
      process.exitCode = 1;
      return;
    }
    config.providers = requested as ProviderId[];
  } else if (!flags.yes) {
    config.providers = (await checkbox({
      message: 'Which AI provider(s) should the workflow be scaffolded for?',
      choices: PROVIDER_IDS.map((id) => ({
        name: PROVIDERS[id].label,
        value: id,
        checked: config.providers.includes(id),
      })),
      validate: (a) => (a.length > 0 ? true : 'Select at least one provider'),
    })) as ProviderId[];
  }

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

  let installVscodeSettings = flags.vscodeSettings !== false;
  if (!flags.yes && flags.vscodeSettings !== false) {
    installVscodeSettings = await confirm({
      message:
        'Create/update .vscode/settings.json with safe terminal auto-approve rules for workflow setup (docs/tickets mkdir + requirements/branch skills)?',
      default: true,
    });
  }

  const written: string[] = [];

  // Install all templates for the selected provider(s).
  const result = await install({ cwd, config });
  written.push(...result.written);

  // Persist config.
  await writeConfig(cwd, config);
  written.push(join(cwd, '.agentic-workflow.json'));

  // Optional workspace settings for VS Code terminal auto-approval.
  if (installVscodeSettings) {
    const settingsPath = await upsertVscodeSettings(cwd);
    written.push(settingsPath);
  }

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

  // Global install: copy components to each provider's user-level locations.
  if (flags.global) {
    const globalResult = await installGlobal(config);
    written.push(...globalResult.written);
  }

  // Optional knowledge-graph layer (https://github.com/Graphify-Labs/graphify).
  // Always attempted best-effort unless explicitly disabled; never blocks or
  // fails the rest of `init` — context-builder/mimir work unchanged either way.
  const wantGraphify = flags.graphify !== false && config.graphify !== false;
  let graphifyStatus: 'skipped' | 'unavailable' | 'declined' | 'ready' = 'skipped';
  if (wantGraphify) {
    let available = isGraphifyInstalled();

    if (!available) {
      if (!flags.yes) {
        const wantsInstall = await confirm({
          message:
            'graphify (optional knowledge-graph layer, github.com/Graphify-Labs/graphify) is not installed. ' +
            'Install it now via uv/pipx/pip for deeper cross-file context queries?',
          default: true,
        });
        if (wantsInstall) {
          console.log(pc.dim('  Installing graphify CLI...'));
          const attempt = tryInstallGraphifyCli();
          available = attempt.installed;
          if (available) {
            console.log(pc.green(`  ✓ graphify installed via ${attempt.method}`));
          } else {
            console.log(
              pc.yellow(
                `  Could not install graphify automatically (${attempt.error}). ` +
                  `Install manually later: ${GRAPHIFY_INSTALL_HINT}`,
              ),
            );
          }
        } else {
          graphifyStatus = 'declined';
        }
      } else {
        // Non-interactive (-y): never make surprise network/package-manager calls.
        graphifyStatus = 'unavailable';
      }
    }

    if (available) {
      for (const pid of config.providers) {
        setupGraphifyForProvider(cwd, pid);
      }
      buildGraphifyGraph(cwd);
      await ensureGraphifyGitignore(cwd);
      graphifyStatus = 'ready';
    } else if (graphifyStatus === 'skipped') {
      graphifyStatus = 'unavailable';
    }
  }
  config.graphify = graphifyStatus === 'ready';
  await writeConfig(cwd, config);

  console.log(pc.green(`\n✓ Installed ${written.length} files.`));
  console.log(pc.dim('Key locations per provider:'));
  for (const pid of config.providers) {
    const p = getProvider(pid);
    console.log(`  ${pc.bold(p.label)}`);
    console.log(`    ${pc.cyan(p.alwaysOnFile)}  always-on rules`);
    console.log(`    ${pc.cyan(p.agentsDir + '/')}  agents (orchestrator, personas, mimir, epic-planner)`);
    console.log(`    ${pc.cyan(p.skillsDir + '/')}  deterministic skills + scripts`);
    console.log(`    ${pc.cyan(p.promptsDir + '/')}  prompts / slash commands`);
  }
  console.log(`  ${pc.cyan(config.docsDir + '/')}  per-ticket artifacts land here`);

  if (config.modelLogging) {
    const actual = config.providers.filter((p) => p !== 'copilot');
    console.log(pc.dim('\nModel-usage logging → ') + pc.cyan('.agentic/logs/model-usage.log'));
    if (actual.length) {
      console.log(
        pc.dim(`  ${actual.join(', ')}: logs the actual resolved model per agent turn.`),
      );
    }
    if (config.providers.includes('copilot')) {
      console.log(
        pc.dim(
          '  copilot: logs the intended (configured) model — Copilot hooks don\'t expose the\n' +
            '           resolved model; hover a subagent in chat to see the actual model + credits.',
        ),
      );
    }
  }

  if (flags.global) {
    console.log(pc.dim('\nGlobal install locations:'));
    for (const pid of config.providers) {
      const g = getProvider(pid).global;
      for (const dir of [g.agentsDir, g.skillsDir, g.promptsDir, g.instructionsDir]) {
        if (dir) console.log(`  ${pc.cyan(dir)}`);
      }
    }
  }

  console.log(
    pc.dim(
      '\nNext: open your agent, pick the "SDLC Orchestrator" (or run /resolve-ticket), ' +
        'and provide a Jira ticket. For a group of repos, run `agentic-workflow workspace init`.',
    ),
  );

  if (graphifyStatus === 'ready') {
    console.log(pc.green('\n✓ graphify knowledge-graph layer wired in.'));
    console.log(pc.dim('  Try: agentic-workflow run graphify -- query "what connects auth to the database?"'));
  } else if (graphifyStatus === 'unavailable' || graphifyStatus === 'declined') {
    console.log(
      pc.dim(
        `\ngraphify not installed (context-builder/mimir still work via TOON context). ` +
          `Install later: ${GRAPHIFY_INSTALL_HINT}`,
      ),
    );
  }
}
