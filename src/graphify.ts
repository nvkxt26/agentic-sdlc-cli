import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProviderId } from './types.js';

/**
 * Best-effort integration with the third-party `graphify` CLI
 * (`graphifyy` on PyPI: https://github.com/Graphify-Labs/graphify).
 *
 * Graphify is an independent Python tool, not an npm dependency — everything
 * here shells out to the `graphify` binary and never throws; callers treat
 * failures as "not available" and fall back to the built-in TOON context
 * (context-builder / mimir keep working with zero degradation).
 */

const INSTALL_HINT = 'uv tool install graphifyy && graphify install';

/** Detect whether the `graphify` CLI is on PATH. */
export function isGraphifyInstalled(): boolean {
  try {
    execFileSync('graphify', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface GraphifyInstallAttempt {
  installed: boolean;
  method?: 'uv' | 'pipx' | 'pip';
  error?: string;
}

/** Try installing the `graphify` CLI itself via uv (preferred), then pipx, then pip. Never throws. */
export function tryInstallGraphifyCli(): GraphifyInstallAttempt {
  const attempts: Array<{ method: 'uv' | 'pipx' | 'pip'; cmd: string; args: string[] }> = [
    { method: 'uv', cmd: 'uv', args: ['tool', 'install', 'graphifyy'] },
    { method: 'pipx', cmd: 'pipx', args: ['install', 'graphifyy'] },
    { method: 'pip', cmd: 'pip', args: ['install', '--user', 'graphifyy'] },
  ];
  for (const a of attempts) {
    try {
      execFileSync(a.cmd, a.args, { stdio: 'ignore' });
      if (isGraphifyInstalled()) return { installed: true, method: a.method };
    } catch {
      // try the next tool
    }
  }
  return { installed: false, error: 'uv, pipx and pip were all unavailable or failed' };
}

/**
 * Map our provider id to graphify's own skill-registration command.
 * Our "copilot" provider targets VS Code Copilot Chat (`.github/...` layout),
 * which graphify treats as its own "vscode" platform.
 */
function skillRegistrationArgs(id: ProviderId): string[] {
  switch (id) {
    case 'claude':
      return ['install'];
    case 'opencode':
      return ['install', '--platform', 'opencode'];
    case 'copilot':
      return ['vscode', 'install'];
  }
}

/** Map our provider id to graphify's "always consult the graph" registration command. */
function alwaysOnRegistrationArgs(id: ProviderId): string[] {
  switch (id) {
    case 'claude':
      return ['claude', 'install'];
    case 'opencode':
      return ['opencode', 'install'];
    case 'copilot':
      return ['vscode', 'install'];
  }
}

export interface GraphifySetupResult {
  provider: ProviderId;
  skillRegistered: boolean;
  alwaysOnRegistered: boolean;
  error?: string;
}

/** Best-effort: register graphify's skill + always-on instructions for one provider. Never throws. */
export function setupGraphifyForProvider(cwd: string, id: ProviderId): GraphifySetupResult {
  const result: GraphifySetupResult = {
    provider: id,
    skillRegistered: false,
    alwaysOnRegistered: false,
  };
  try {
    execFileSync('graphify', skillRegistrationArgs(id), { cwd, stdio: 'ignore' });
    result.skillRegistered = true;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  try {
    execFileSync('graphify', alwaysOnRegistrationArgs(id), { cwd, stdio: 'ignore' });
    result.alwaysOnRegistered = true;
  } catch (e) {
    result.error ??= e instanceof Error ? e.message : String(e);
  }
  return result;
}

/** Best-effort: build the initial knowledge graph (code-only extraction is offline/free). Never throws. */
export function buildGraphifyGraph(cwd: string): { built: boolean; error?: string } {
  try {
    execFileSync('graphify', ['extract', '.', '--no-viz'], { cwd, stdio: 'ignore' });
    return { built: true };
  } catch (e) {
    return { built: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Append graphify's local-only state to `.gitignore`, without touching the
 * generic `ensureGitignore` helper (graphify-out/ itself is meant to be
 * committed — only the cost log and resolved interpreter marker are local).
 */
export async function ensureGraphifyGitignore(cwd: string): Promise<void> {
  const path = join(cwd, '.gitignore');
  let body = existsSync(path) ? await readFile(path, 'utf8') : '';
  const entries = ['graphify-out/cost.json', 'graphify-out/.graphify_python'];
  const present = new Set(body.split(/\r?\n/).map((l) => l.trim()));
  const missing = entries.filter((e) => !present.has(e));
  if (missing.length === 0) return;

  const MARKER = '# graphify (local-only state; graphify-out/ itself should be committed)';
  if (body.length > 0 && !body.endsWith('\n')) body += '\n';
  if (!body.includes(MARKER)) body += `\n${MARKER}\n`;
  for (const e of missing) body += `${e}\n`;

  await writeFile(path, body, 'utf8');
}

export { INSTALL_HINT as GRAPHIFY_INSTALL_HINT };
