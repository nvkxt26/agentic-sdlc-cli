import { readdir, mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, isAbsolute, basename } from 'node:path';
import { checkbox } from '@inquirer/prompts';
import pc from 'picocolors';
import {
  defaultWorkspaceConfig,
  readWorkspaceConfig,
  writeWorkspaceConfig,
  findWorkspaceRoot,
  readConfig,
  defaultConfig,
} from '../config.js';
import { install } from '../installer.js';
import { isProviderId, PROVIDER_IDS, PROVIDERS, getProvider } from '../providers.js';
import type { AgenticConfig, ProviderId, WorkspaceConfig, WorkspaceRepo } from '../types.js';

interface WorkspaceFlags {
  yes?: boolean;
  provider?: string;
  cwd?: string;
}

/** Immediate sub-directories that are git repos. */
async function discoverRepos(root: string): Promise<WorkspaceRepo[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const repos: WorkspaceRepo[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    if (existsSync(join(root, e.name, '.git'))) {
      repos.push({ name: e.name, path: e.name });
    }
  }
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveProviders(flag: string | undefined, fallback: ProviderId[]): ProviderId[] | null {
  if (!flag) return fallback;
  const requested = flag.split(',').map((s) => s.trim()).filter(Boolean);
  const invalid = requested.filter((p) => !isProviderId(p));
  if (invalid.length) {
    console.error(pc.red(`Invalid --provider ${invalid.join(', ')}. Valid: ${PROVIDER_IDS.join(', ')}`));
    return null;
  }
  return requested as ProviderId[];
}

/** Turn a workspace config into an AgenticConfig for root-level template install. */
function workspaceAgenticConfig(ws: WorkspaceConfig): AgenticConfig {
  return {
    ...defaultConfig(),
    providers: ws.providers,
    docsDir: ws.docsDir,
    registryDir: ws.registryDir,
  };
}

function repoAbsPath(root: string, repo: WorkspaceRepo): string {
  return isAbsolute(repo.path) ? repo.path : resolve(root, repo.path);
}

/** `workspace init` — mark a folder that groups repos and install workspace-level agents. */
export async function workspaceInit(flags: WorkspaceFlags): Promise<void> {
  const root = flags.cwd ? resolve(process.cwd(), flags.cwd) : process.cwd();

  const existing = await readWorkspaceConfig(root);
  const ws = existing ?? defaultWorkspaceConfig();

  let providers = resolveProviders(flags.provider, ws.providers);
  if (!providers) {
    process.exitCode = 1;
    return;
  }
  if (!flags.provider && !flags.yes) {
    providers = (await checkbox({
      message: 'Which AI provider(s) for the workspace?',
      choices: PROVIDER_IDS.map((id) => ({
        name: PROVIDERS[id].label,
        value: id,
        checked: ws.providers.includes(id),
      })),
      validate: (a) => (a.length > 0 ? true : 'Select at least one provider'),
    })) as ProviderId[];
  }
  ws.providers = providers;

  ws.repos = await discoverRepos(root);

  await writeWorkspaceConfig(root, ws);
  await mkdir(join(root, ws.registryDir), { recursive: true });

  // Install the full component set at the workspace root so orchestrator,
  // epic-planner and mimir are available across the group.
  const result = await install({ cwd: root, config: workspaceAgenticConfig(ws) });

  console.log(pc.green(`\n✓ Workspace initialised at ${pc.cyan(root)} (${result.written.length + 1} files).`));
  console.log(pc.dim(`  ${basename(root)}/.agentic-workspace.json  workspace config`));
  console.log(pc.dim(`  ${ws.registryDir}/                shared cross-repo context registry`));
  console.log(pc.bold(`\nMember repos (${ws.repos.length}):`));
  for (const r of ws.repos) console.log(`  ${pc.cyan(r.name)}  ${pc.dim(r.path)}`);
  console.log(
    pc.dim(
      '\nNext:\n' +
        '  1. In each repo: `agentic-workflow init` (per-repo agents/skills).\n' +
        '  2. `agentic-workflow workspace sync` to publish each repo\'s context to the registry.\n' +
        '  3. Use the Epic Planner agent (or /plan-epic) at the workspace root.',
    ),
  );
}

/** `workspace list` — show member repos and their install/publish state. */
export async function workspaceList(flags: WorkspaceFlags): Promise<void> {
  const start = flags.cwd ? resolve(process.cwd(), flags.cwd) : process.cwd();
  const root = findWorkspaceRoot(start);
  if (!root) {
    console.error(pc.red('No .agentic-workspace.json found. Run `agentic-workflow workspace init` first.'));
    process.exitCode = 1;
    return;
  }
  const ws = (await readWorkspaceConfig(root))!;

  console.log(pc.bold(`\nWorkspace: ${pc.cyan(root)}`));
  console.log(pc.dim(`Providers: ${ws.providers.join(', ')}   Registry: ${ws.registryDir}`));
  console.log(pc.bold(`\nRepos (${ws.repos.length}):`));
  for (const r of ws.repos) {
    const abs = repoAbsPath(root, r);
    const installed = existsSync(join(abs, '.agentic-workflow.json'));
    const published = existsSync(join(root, ws.registryDir, r.name, 'context'));
    const flag = (ok: boolean, label: string) => (ok ? pc.green(label) : pc.dim(label));
    console.log(
      `  ${pc.bold(r.name.padEnd(24))} ${flag(installed, 'installed')}  ${flag(published, 'published')}  ${pc.dim(r.path)}`,
    );
  }
  console.log('');
}

/** `workspace sync` — publish each repo's context into the shared registry. */
export async function workspaceSync(flags: WorkspaceFlags): Promise<void> {
  const start = flags.cwd ? resolve(process.cwd(), flags.cwd) : process.cwd();
  const root = findWorkspaceRoot(start);
  if (!root) {
    console.error(pc.red('No .agentic-workspace.json found. Run `agentic-workflow workspace init` first.'));
    process.exitCode = 1;
    return;
  }
  const ws = (await readWorkspaceConfig(root))!;
  const registryRoot = join(root, ws.registryDir);

  let published = 0;
  let skipped = 0;
  for (const repo of ws.repos) {
    const abs = repoAbsPath(root, repo);
    const cfg = (await readConfig(abs)) ?? defaultConfig();
    const contextDir = join(abs, cfg.contextDir ?? '.agentic/context');
    if (!existsSync(contextDir)) {
      console.log(`  ${pc.yellow('skip')} ${repo.name} ${pc.dim('(no context — run the context-builder agent first)')}`);
      skipped++;
      continue;
    }

    const destContext = join(registryRoot, repo.name, 'context');
    await mkdir(destContext, { recursive: true });

    let files: string[] = [];
    try {
      files = (await readdir(contextDir)).filter(
        (f) => f.endsWith('.toon') || f === 'context-meta.json',
      );
    } catch {
      files = [];
    }
    for (const f of files) await copyFile(join(contextDir, f), join(destContext, f));

    // Manifest so peer agents can locate the repo without reading its config.
    let lastCommit = '';
    const metaPath = join(contextDir, 'context-meta.json');
    if (existsSync(metaPath)) {
      try {
        lastCommit = JSON.parse(await readFile(metaPath, 'utf8')).lastCommit ?? '';
      } catch {
        /* ignore */
      }
    }
    const providerDirs = ws.providers.map((p) => getProvider(p).agentsDir);
    const manifest = {
      name: repo.name,
      path: repo.path,
      providers: ws.providers,
      agentsDirs: providerDirs,
      lastCommit,
      contextFiles: files,
      updatedAt: new Date().toISOString(),
    };
    await mkdir(join(registryRoot, repo.name), { recursive: true });
    await writeFile(
      join(registryRoot, repo.name, 'repo.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8',
    );

    console.log(`  ${pc.green('published')} ${repo.name} ${pc.dim(`(${files.length} files)`)}`);
    published++;
  }

  console.log(
    pc.green(`\n✓ Registry updated at ${pc.cyan(ws.registryDir)}: ${published} published, ${skipped} skipped.`),
  );
}
