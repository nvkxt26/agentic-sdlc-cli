import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { defaultConfig, readConfig, writeConfig } from './config.js';
import { LEGACY_CONFIG_FILE } from './paths.js';

describe('config', () => {
  it('returns defaults when writing and reading config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-config-'));
    try {
      const cfg = defaultConfig();
      await writeConfig(dir, cfg);
      const loaded = await readConfig(dir);
      expect(loaded).toEqual(cfg);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('backfills missing fields from older config versions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-config-'));
    try {
      const minimal = {
        version: '1.0.0',
        providers: ['copilot'],
      };
      await writeConfig(dir, minimal as any);
      const loaded = await readConfig(dir);
      expect(loaded?.docsDir).toBe('docs');
      expect(loaded?.defaultOutputMode).toBe('comments');
      expect(loaded?.reviewLoops).toBe(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reads the legacy config filename when the new file is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentic-config-'));
    try {
      const legacyPath = join(dir, LEGACY_CONFIG_FILE);
      const legacy = {
        version: '1.0.0',
        providers: ['claude'],
        docsDir: 'legacy-docs',
      };
      await import('node:fs/promises').then(({ writeFile }) =>
        writeFile(legacyPath, JSON.stringify(legacy, null, 2) + '\n', 'utf8'),
      );

      const loaded = await readConfig(dir);
      expect(loaded?.providers).toEqual(['claude']);
      expect(loaded?.docsDir).toBe('legacy-docs');
      expect(loaded?.defaultOutputMode).toBe('comments');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
