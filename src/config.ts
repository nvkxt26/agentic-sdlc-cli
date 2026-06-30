import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgenticConfig } from './types.js';
import { CONFIG_FILE } from './paths.js';

export const CONFIG_VERSION = '1.0.0';

export function defaultConfig(): AgenticConfig {
  return {
    version: CONFIG_VERSION,
    docsDir: 'docs',
    contextDir: '.agentic/context',
    cacheDir: '.agentic/cache',
    reviewLoops: 5,
    defaultOutputMode: 'comments',
    envVars: [
      'ATLASSIAN_BASE_URL',
      'ATLASSIAN_EMAIL',
      'ATLASSIAN_API_TOKEN',
      'FIGMA_API_TOKEN',
    ],
    modelOverrides: {},
  };
}

export function configPath(cwd: string): string {
  return join(cwd, CONFIG_FILE);
}

export async function readConfig(cwd: string): Promise<AgenticConfig | null> {
  const p = configPath(cwd);
  if (!existsSync(p)) return null;
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw) as AgenticConfig;
}

export async function writeConfig(cwd: string, config: AgenticConfig): Promise<void> {
  await writeFile(configPath(cwd), JSON.stringify(config, null, 2) + '\n', 'utf8');
}
