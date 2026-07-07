import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  COPILOT_AGENTIC_SDLC_AGENTS_DIR,
  COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR,
  COPILOT_AGENTIC_SDLC_PROMPTS_DIR,
} from './providers.js';
import { upsertVscodeSettings } from './vscodeSettings.js';

describe('upsertVscodeSettings', () => {
  it('merges auto-approve rules with Copilot custom location settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-vscode-settings-'));
    try {
      await upsertVscodeSettings(dir, { includeCopilotCustomizations: true });
      const raw = await readFile(join(dir, '.vscode', 'settings.json'), 'utf8');
      const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;

      expect(parsed['chat.tools.terminal.autoApprove']).toBeTruthy();
      expect(parsed['chat.agentFilesLocations'][COPILOT_AGENTIC_SDLC_AGENTS_DIR]).toBe(true);
      expect(parsed['chat.promptFilesLocations'][COPILOT_AGENTIC_SDLC_PROMPTS_DIR]).toBe(true);
      expect(parsed['chat.instructionsFilesLocations'][COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR]).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('preserves existing location settings while adding agentic-sdlc entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-vscode-settings-'));
    try {
      const file = join(dir, '.vscode', 'settings.json');
      await upsertVscodeSettings(dir, { includeCopilotCustomizations: true });

      const raw = await readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
      parsed['chat.promptFilesLocations']['custom/prompts'] = true;

      await import('node:fs/promises').then(({ writeFile }) =>
        writeFile(file, JSON.stringify(parsed, null, 2) + '\n', 'utf8'),
      );

      await upsertVscodeSettings(dir, { includeCopilotCustomizations: true });
      const merged = JSON.parse(await readFile(file, 'utf8')) as Record<string, Record<string, boolean>>;

      expect(merged['chat.promptFilesLocations']['custom/prompts']).toBe(true);
      expect(merged['chat.promptFilesLocations'][COPILOT_AGENTIC_SDLC_PROMPTS_DIR]).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});