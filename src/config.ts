import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, parse } from 'node:path';
import type { AgenticConfig, WorkspaceConfig } from './types.js';
import { CONFIG_FILE, WORKSPACE_FILE } from './paths.js';

export const CONFIG_VERSION = '1.0.0';

export function defaultConfig(): AgenticConfig {
  return {
    version: CONFIG_VERSION,
    providers: ['copilot'],
    docsDir: 'docs',
    contextDir: '.agentic/context',
    cacheDir: '.agentic/cache',
    registryDir: '.agentic/registry',
    reviewLoops: 5,
    defaultOutputMode: 'comments',
    envVars: [
      'ATLASSIAN_BASE_URL',
      'ATLASSIAN_EMAIL',
      'ATLASSIAN_API_TOKEN',
      'FIGMA_API_TOKEN',
    ],
    modelOverrides: {},
    graphify: true,
    modelLogging: true,
  };
}

export function configPath(cwd: string): string {
  return join(cwd, CONFIG_FILE);
}

export async function readConfig(cwd: string): Promise<AgenticConfig | null> {
  const p = configPath(cwd);
  if (!existsSync(p)) return null;
  const raw = await readFile(p, 'utf8');
  const parsed = JSON.parse(raw) as Partial<AgenticConfig>;
  // Backfill fields added in later versions so older configs keep working.
  return { ...defaultConfig(), ...parsed } as AgenticConfig;
}

export async function writeConfig(cwd: string, config: AgenticConfig): Promise<void> {
  await writeFile(configPath(cwd), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// ---- workspace ---------------------------------------------------------------

export function defaultWorkspaceConfig(): WorkspaceConfig {
  return {
    version: CONFIG_VERSION,
    providers: ['copilot'],
    registryDir: '.agentic/registry',
    docsDir: 'docs',
    repos: [],
  };
}

export function workspacePath(cwd: string): string {
  return join(cwd, WORKSPACE_FILE);
}

export async function readWorkspaceConfig(cwd: string): Promise<WorkspaceConfig | null> {
  const p = workspacePath(cwd);
  if (!existsSync(p)) return null;
  const raw = await readFile(p, 'utf8');
  const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>;
  return { ...defaultWorkspaceConfig(), ...parsed } as WorkspaceConfig;
}

export async function writeWorkspaceConfig(cwd: string, config: WorkspaceConfig): Promise<void> {
  await writeFile(workspacePath(cwd), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Walk up from `start` looking for a `.agentic-workspace.json`. Returns the
 * directory that contains it, or null if none is found.
 */
export function findWorkspaceRoot(start: string): string | null {
  let dir = start;
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, WORKSPACE_FILE))) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}
