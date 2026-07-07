#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { runCommand } from './commands/run.js';
import { workspaceInit, workspaceList, workspaceSync } from './commands/workspace.js';

const program = new Command();

program
  .name('agentic-sdlc')
  .description(
    'Installable agentic SDLC workflow CLI — scaffolds agents, deterministic skills,\n' +
      'and an orchestrator for GitHub Copilot, Claude Code, or OpenCode. Agents\n' +
      'communicate via TOON (caveman FULL).',
  )
  .version('1.0.0');

program
  .command('init')
  .description('Interactively install the workflow into the current project.')
  .option('-y, --yes', 'accept defaults, skip prompts')
  .option('-d, --docs-dir <dir>', 'per-ticket docs directory')
  .option('-C, --cwd <dir>', 'target project directory (relative to current)')
  .option('-p, --provider <ids>', 'comma list of providers: copilot,claude,opencode')
  .option(
    '--global',
    'also install to each provider\'s user-level locations (available in every project)',
  )
  .option(
    '--no-graphify',
    'skip the optional graphify knowledge-graph layer entirely (default: attempt best-effort)',
  )
  .option(
    '--no-model-logging',
    'skip installing the per-provider model-usage logger (.agentic/logs/model-usage.log)',
  )
  .option(
    '--no-vscode-settings',
    'skip creating/updating .vscode/settings.json auto-approve rules for setup/requirements skills',
  )
  .option(
    '--no-gitignore-sdlc',
    'do not add .github/agentic-sdlc or .vscode/settings.json entries to .gitignore',
  )
  .action((opts) => initCommand(opts));

program
  .command('list')
  .alias('ls')
  .description('List available agents and skills with their resolved models per provider.')
  .action(() => listCommand());

program
  .command('add <target>')
  .description('Add a single skill or agent to the current project.')
  .option('-m, --model <tier>', 'override model tier (reasoning-max|reasoning-high|coding|balanced|light)')
  .option('-p, --provider <ids>', 'comma list of providers: copilot,claude,opencode')
  .action((target, opts) => addCommand(target, opts));

program
  .command('run <skill>')
  .description('Run a deterministic skill script (args after -- are forwarded). Emits TOON.')
  .allowUnknownOption(true)
  .argument('[args...]', 'arguments forwarded to the skill script')
  .action((skill, args) => runCommand(skill, args ?? []));

// Workspace (group of repos) commands ----------------------------------------
const workspace = program
  .command('workspace')
  .alias('ws')
  .description('Manage a workspace: a folder that groups several repos (epic planning, shared context).');

workspace
  .command('init')
  .description('Mark the current folder as a workspace, discover member repos, install workspace agents.')
  .option('-y, --yes', 'accept defaults, skip prompts')
  .option('-p, --provider <ids>', 'comma list of providers: copilot,claude,opencode')
  .option('-C, --cwd <dir>', 'workspace root directory (relative to current)')
  .action((opts) => workspaceInit(opts));

workspace
  .command('list')
  .alias('ls')
  .description('List member repos and whether each is installed / has published context.')
  .option('-C, --cwd <dir>', 'start directory (relative to current)')
  .action((opts) => workspaceList(opts));

workspace
  .command('sync')
  .description('Publish each repo\'s codebase context into the shared cross-repo registry.')
  .option('-C, --cwd <dir>', 'start directory (relative to current)')
  .action((opts) => workspaceSync(opts));

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
