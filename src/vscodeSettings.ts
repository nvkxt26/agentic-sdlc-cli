import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  COPILOT_AGENTIC_SDLC_AGENTS_DIR,
  COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR,
  COPILOT_AGENTIC_SDLC_PROMPTS_DIR,
} from './providers.js';

const SETTINGS_FILE = join('.vscode', 'settings.json');

const SAFE_TERMINAL_AUTO_APPROVE: Record<string, boolean> = {
  '/^mkdir(\\s+-p)?\\s+(("|\')?docs\\/tickets\\/)/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+jira\\b/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+confluence\\b/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+figma\\b/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+context-sync\\b/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+cache\\b/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+repo-bridge\\b/': true,
  '/^(npx\\s+)?agentic-sdlc\\s+run\\s+git-branch\\b/': true,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function booleanRecord(v: unknown): Record<string, boolean> {
  return isRecord(v)
    ? Object.fromEntries(Object.entries(v).map(([k, value]) => [k, Boolean(value)]))
    : {};
}

function mergeBooleanRecord(
  root: Record<string, unknown>,
  key: string,
  entries: Record<string, boolean>,
): void {
  const current = booleanRecord(root[key]);
  for (const [pattern, value] of Object.entries(entries)) current[pattern] = value;
  root[key] = current;
}

interface VscodeSettingsOptions {
  includeCopilotCustomizations?: boolean;
}

/**
 * Create/update workspace `.vscode/settings.json` with safe terminal
 * auto-approval patterns used by the SDLC workflow setup + product stages.
 */
export async function upsertVscodeSettings(
  cwd: string,
  opts: VscodeSettingsOptions = {},
): Promise<string> {
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

  mergeBooleanRecord(root, 'chat.tools.terminal.autoApprove', SAFE_TERMINAL_AUTO_APPROVE);

  if (opts.includeCopilotCustomizations) {
    mergeBooleanRecord(root, 'chat.agentFilesLocations', {
      [COPILOT_AGENTIC_SDLC_AGENTS_DIR]: true,
    });
    mergeBooleanRecord(root, 'chat.promptFilesLocations', {
      [COPILOT_AGENTIC_SDLC_PROMPTS_DIR]: true,
    });
    mergeBooleanRecord(root, 'chat.instructionsFilesLocations', {
      [COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR]: true,
    });
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(root, null, 2) + '\n', 'utf8');
  return path;
}