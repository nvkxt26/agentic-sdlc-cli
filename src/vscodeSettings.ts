import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SETTINGS_FILE = join('.vscode', 'settings.json');

const SAFE_TERMINAL_AUTO_APPROVE: Record<string, boolean> = {
  '/^mkdir(\\s+-p)?\\s+(("|\')?docs\\/tickets\\/)/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+jira\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+confluence\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+figma\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+context-sync\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+cache\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+repo-bridge\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+graphify\\b/': true,
  '/^(npx\\s+)?agentic-workflow\\s+run\\s+git-branch\\b/': true,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Create/update workspace `.vscode/settings.json` with safe terminal
 * auto-approval patterns used by the SDLC workflow setup + product stages.
 */
export async function upsertVscodeSettings(cwd: string): Promise<string> {
  const path = join(cwd, SETTINGS_FILE);
  let root: Record<string, unknown> = {};

  if (existsSync(path)) {
    const raw = await readFile(path, 'utf8');
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed)) throw new Error('settings root is not an object');
      root = parsed;
    } catch (err) {
      throw new Error(
        `Cannot update ${SETTINGS_FILE}: file is not valid JSON (${err instanceof Error ? err.message : String(err)}).`,
      );
    }
  }

  const current = root['chat.tools.terminal.autoApprove'];
  const autoApprove: Record<string, boolean> = isRecord(current)
    ? Object.fromEntries(Object.entries(current).map(([k, v]) => [k, Boolean(v)]))
    : {};

  for (const [pattern, value] of Object.entries(SAFE_TERMINAL_AUTO_APPROVE)) {
    autoApprove[pattern] = value;
  }

  root['chat.tools.terminal.autoApprove'] = autoApprove;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(root, null, 2) + '\n', 'utf8');
  return path;
}