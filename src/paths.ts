import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Absolute path to the bundled templates/ directory.
 *
 * Both src/ (dev via tsx) and dist/ (published) live one level under the
 * package root, so `../templates` resolves correctly in either case.
 */
export function templatesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'templates');
}

/** Config file name written into the target project root. */
export const CONFIG_FILE = '.agentic-workflow.json';

/** Root folder for installed Copilot customizations in the target project. */
export const GITHUB_DIR = '.github';

/** VS Code user data directory (OS-aware). */
export function vscodeUserDir(): string {
  const home = homedir();
  switch (process.platform) {
    case 'win32':
      return join(process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), 'Code', 'User');
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Code', 'User');
    default: // linux + other unix
      return join(home, '.config', 'Code', 'User');
  }
}

/**
 * Global VS Code user prompts folder.
 * Copilot picks up *.prompt.md and *.instructions.md from here automatically.
 */
export function globalPromptsDir(): string {
  return join(vscodeUserDir(), 'prompts');
}

/**
 * Global Copilot skills folder (~/.copilot/skills/).
 * Copilot auto-discovers SKILL.md directories placed here.
 */
export function globalSkillsDir(): string {
  return join(homedir(), '.copilot', 'skills');
}
