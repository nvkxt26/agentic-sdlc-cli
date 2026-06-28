/**
 * postinstall hook.
 *
 * When this package is installed as a dependency of another project, scaffold
 * the Copilot customization files (agents / skills / instructions / prompts)
 * into that project's `.github/` so they are immediately usable by Copilot.
 *
 * This runs non-interactively and must NEVER fail the host install — every
 * error is swallowed with a warning.
 */
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, writeEnvExample } from './installer.js';
import { readConfig, writeConfig, defaultConfig } from './config.js';

async function main(): Promise<void> {
  // INIT_CWD is the directory where the user ran `npm install`.
  const initCwd = process.env.INIT_CWD;
  if (!initCwd) return;

  // Don't scaffold for global installs — there is no target project.
  if (process.env.npm_config_global === 'true') return;

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

  // When npm installs this package from a git URL it first clones the repo and
  // runs `npm install --force` inside the clone to "prepare" it. During that
  // inner install our postinstall fires with INIT_CWD pointing at the caller's
  // shell directory — scaffolding there would be an unintended side-effect.
  // The reliable signal that we are the git clone being prepared (not a
  // consumer dep) is that src/ still lives next to dist/ in packageRoot.
  if (existsSync(join(packageRoot, 'src'))) return;

  const target = resolve(initCwd);

  // Skip when installing inside this package itself (local development).
  if (target === packageRoot) return;

  // Only scaffold into real projects (must have a package.json).
  if (!existsSync(join(target, 'package.json'))) return;

  try {
    const config = (await readConfig(target)) ?? defaultConfig();
    const result = await install({ cwd: target, config });

    const written = [...result.written];
    // Preserve an existing config (keeps user docsDir / model overrides).
    if (!existsSync(join(target, '.agentic-workflow.json'))) {
      await writeConfig(target, config);
      written.push(join(target, '.agentic-workflow.json'));
    }
    await writeEnvExample(target, config.envVars, written);

    console.log(
      `\n[agentic-workflow] added ${written.length} Copilot files to .github/ ` +
        `(agents, skills, instructions, prompts).\n` +
        `[agentic-workflow] run \`npx agentic-workflow init\` to configure docs dir / credentials.\n`,
    );
  } catch (err) {
    console.warn(
      `[agentic-workflow] postinstall skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

void main();
