import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
