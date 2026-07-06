import { mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { templatesDir } from './paths.js';
import type { ProviderId } from './types.js';

/**
 * Installs the per-provider "model-usage logger" that records which model each
 * agent actually runs on, before and after each agent turn, to
 * `.agentic/logs/model-usage.log`.
 *
 * Ground-truth availability differs by runtime (see each block below):
 *   - OpenCode / Claude Code → the ACTUAL resolved model (from runtime events /
 *     the session transcript).
 *   - GitHub Copilot → the INTENDED (configured) model only; Copilot's hook
 *     payloads do not expose the resolved model, so the logger records the
 *     agent's configured model and points to the chat UI for the real one.
 *
 * All artefacts are best-effort and self-contained; a logging failure can never
 * disrupt an agent session.
 */

const SRC_DIR = 'model-logging';

async function writeOut(dest: string, content: string, written: string[]): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, content, 'utf8');
  written.push(dest);
}

async function copyTemplate(
  templateFile: string,
  dest: string,
  written: string[],
  executable = false,
): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(join(templatesDir(), SRC_DIR, templateFile), dest);
  if (executable) await chmod(dest, 0o755);
  written.push(dest);
}

/** Marker used to detect our own hook entry when merging `.claude/settings.json`. */
const CLAUDE_SCRIPT = '.claude/hooks/agentic-model-logger.mjs';

interface ClaudeHookHandler {
  type: string;
  command: string;
  args?: string[];
}
interface ClaudeHookGroup {
  matcher?: string;
  hooks: ClaudeHookHandler[];
}

/** Merge our logger into `.claude/settings.json` for Stop + SubagentStop, idempotently. */
async function mergeClaudeSettings(cwd: string, written: string[]): Promise<void> {
  const path = join(cwd, '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      settings = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }

  const hooks = (settings['hooks'] ??= {}) as Record<string, ClaudeHookGroup[]>;
  const handler: ClaudeHookHandler = {
    type: 'command',
    command: 'node',
    args: [`\${CLAUDE_PROJECT_DIR}/${CLAUDE_SCRIPT}`],
  };

  for (const event of ['Stop', 'SubagentStop']) {
    const groups = (hooks[event] ??= []);
    const already = groups.some((g) =>
      g.hooks?.some((h) => (h.args ?? []).some((a) => a.includes('agentic-model-logger.mjs'))),
    );
    if (!already) groups.push({ matcher: '*', hooks: [handler] });
  }

  await writeOut(path, JSON.stringify(settings, null, 2) + '\n', written);
}

/** Install model-usage logging for a single provider. Never throws. */
export async function installModelLogging(
  provider: ProviderId,
  cwd: string,
  written: string[],
): Promise<void> {
  switch (provider) {
    case 'opencode':
      // Auto-loaded plugin; reads the real providerID/modelID off message events.
      await copyTemplate(
        'opencode-model-logger.js',
        join(cwd, '.opencode', 'plugins', 'agentic-model-logger.js'),
        written,
      );
      break;

    case 'claude':
      // Hook script reads the actual model from the session transcript.
      await copyTemplate(
        'claude-model-logger.mjs',
        join(cwd, '.claude', 'hooks', 'agentic-model-logger.mjs'),
        written,
        true,
      );
      await mergeClaudeSettings(cwd, written);
      break;

    case 'copilot':
      // Hook config + script log the intended (configured) model; Copilot hook
      // payloads don't expose the resolved model.
      await copyTemplate(
        'copilot-hooks.json',
        join(cwd, '.github', 'hooks', 'agentic-model-logging.json'),
        written,
      );
      await copyTemplate(
        'copilot-model-logger.mjs',
        join(cwd, '.github', 'hooks', 'agentic-model-logger.mjs'),
        written,
        true,
      );
      break;
  }
}
