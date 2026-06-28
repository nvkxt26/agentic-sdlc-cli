#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { addCommand } from './commands/add.js';
import { runCommand } from './commands/run.js';

const program = new Command();

program
  .name('agentic-workflow')
  .description(
    'Installable agentic SDLC workflow CLI — installs GitHub Copilot skills, persona agents,\n' +
      'and an orchestrator that communicate via TOON (caveman FULL).',
  )
  .version('1.0.0');

program
  .command('init')
  .description('Interactively install the workflow into the current project (.github/).')
  .option('-y, --yes', 'accept defaults, skip prompts')
  .option('-d, --docs-dir <dir>', 'per-ticket docs directory')
  .option('-C, --cwd <dir>', 'target project directory (relative to current)')
  .action((opts) => initCommand(opts));

program
  .command('list')
  .alias('ls')
  .description('List available agents and skills with their default models.')
  .action(() => listCommand());

program
  .command('add <target>')
  .description('Add a single skill or agent to the current project.')
  .option('-m, --model <tier>', 'override model tier (reasoning-max|reasoning-high|coding|balanced|light)')
  .action((target, opts) => addCommand(target, opts));

program
  .command('run <skill>')
  .description('Run a deterministic skill script (args after -- are forwarded). Emits TOON.')
  .allowUnknownOption(true)
  .argument('[args...]', 'arguments forwarded to the skill script')
  .action((skill, args) => runCommand(skill, args ?? []));

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
});
