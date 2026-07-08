import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gitBranchScript = join(repoRoot, 'templates/skills/git-branch/scripts/git-branch.mjs');
const contextSyncScript = join(repoRoot, 'templates/skills/context-sync/scripts/context-sync.mjs');
const noAddedCommentsScript = join(repoRoot, 'templates/skills/no-added-comments/scripts/no-added-comments.mjs');

let dir: string;

function git(args: string[], cwd = dir): string {
  return execFileSync('git', ['-c', 'user.email=t@t.dev', '-c', 'user.name=t', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();
}

function runNode(script: string, args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync('node', [script, ...args], { cwd: dir, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e: any) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function commitFile(name: string, content: string, message: string): string {
  writeFileSync(join(dir, name), content);
  git(['add', name]);
  git(['commit', '-m', message]);
  return git(['rev-parse', 'HEAD']);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gb-cs-'));
  git(['init', '-b', 'main']);
  commitFile('README.md', 'hello\n', 'init');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('git-branch --base', () => {
  it('branches from the base ref, not the current HEAD, and reports base/baseCommit', () => {
    const mainHead = git(['rev-parse', 'main']);
    git(['checkout', '-b', 'feature/prev']);
    commitFile('stray.txt', 'stray\n', 'stray work');

    const { code, out } = runNode(gitBranchScript, [
      '--type', 'feat', '--ticket', 'ABC-1', '--desc', 'base selection', '--base', 'main',
    ]);

    expect(code).toBe(0);
    expect(out).toContain('name: feat/ABC-1_base-selection');
    expect(out).toContain('base: main');
    expect(out).toContain(`baseCommit: ${mainHead}`);
    expect(git(['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('feat/ABC-1_base-selection');
    expect(git(['rev-parse', 'HEAD'])).toBe(mainHead);
  });

  it('refuses to switch base when tracked files have uncommitted changes', () => {
    writeFileSync(join(dir, 'README.md'), 'modified\n');
    const { code, out } = runNode(gitBranchScript, [
      '--type', 'feat', '--ticket', 'ABC-2', '--desc', 'x', '--base', 'main',
    ]);
    expect(code).not.toBe(0);
    expect(out).toContain('error:');
    expect(out).toContain('refusing to switch base');
  });

  it('ignores untracked files (docs folder) when switching base', () => {
    mkdirSync(join(dir, 'docs', 'tickets', 'ABC-3'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'tickets', 'ABC-3', 'requirements.toon'), 'ticket: ABC-3\n');
    const { code, out } = runNode(gitBranchScript, [
      '--type', 'feat', '--ticket', 'ABC-3', '--desc', 'x', '--base', 'main',
    ]);
    expect(code).toBe(0);
    expect(out).toContain('name: feat/ABC-3_x');
  });

  it('keeps legacy behavior (branch from current HEAD) when --base is omitted', () => {
    git(['checkout', '-b', 'feature/prev']);
    const stray = commitFile('stray.txt', 'stray\n', 'stray');
    const { code, out } = runNode(gitBranchScript, [
      '--type', 'feat', '--ticket', 'ABC-4', '--desc', 'x',
    ]);
    expect(code).toBe(0);
    expect(out).not.toContain('base:');
    expect(git(['rev-parse', 'HEAD'])).toBe(stray);
  });
});

describe('context-sync --base edge cases', () => {
  const contextDir = '.agentic/context';
  function seedDocs() {
    const abs = join(dir, contextDir);
    mkdirSync(abs, { recursive: true });
    for (const f of ['overview.toon', 'modules.toon', 'glossary.toon']) {
      writeFileSync(join(abs, f), `# ${f}\n`);
    }
    return abs;
  }
  function writeMeta(absDir: string, branch: string, lastCommit: string) {
    writeFileSync(
      join(absDir, 'context-meta.json'),
      JSON.stringify({ version: 1, branch, lastCommit, updatedAt: new Date().toISOString() }, null, 2),
    );
  }

  it('forces full rebuild with base-branch-changed when meta.branch differs from base', () => {
    const abs = seedDocs();
    const head = git(['rev-parse', 'main']);
    writeMeta(abs, 'develop', head);
    const { code, out } = runNode(contextSyncScript, ['--context-dir', contextDir, '--base', 'main']);
    expect(code).toBe(0);
    expect(out).toContain('mode: full');
    expect(out).toContain('rebuildReason: base-branch-changed');
    expect(out).toContain('previousBranch: develop');
  });

  it('forces full rebuild with context-not-ancestor-of-base when marker is ahead of / diverged from base', () => {
    const abs = seedDocs();
    git(['checkout', '-b', 'other']);
    const divergent = commitFile('other.txt', 'x\n', 'divergent');
    git(['checkout', 'main']);
    commitFile('more.txt', 'y\n', 'advance main');
    writeMeta(abs, 'main', divergent);
    const { code, out } = runNode(contextSyncScript, ['--context-dir', contextDir, '--base', 'main']);
    expect(code).toBe(0);
    expect(out).toContain('mode: full');
    expect(out).toContain('rebuildReason: context-not-ancestor-of-base');
  });

  it('does an incremental diff when the marker is an ancestor of the base HEAD', () => {
    const abs = seedDocs();
    const first = git(['rev-parse', 'main']);
    commitFile('feature.ts', 'export const a = 1;\n', 'add feature');
    writeMeta(abs, 'main', first);
    const { code, out } = runNode(contextSyncScript, ['--context-dir', contextDir, '--base', 'main']);
    expect(code).toBe(0);
    expect(out).toContain('mode: incremental');
    expect(out).toContain('feature.ts');
  });
});

describe('no-added-comments', () => {
  function stage(name: string, content: string) {
    writeFileSync(join(dir, name), content);
    git(['add', name]);
  }

  it('flags an added inline comment line and exits non-zero', () => {
    commitFile('f.ts', 'const a = 1;\n', 'base');
    stage('f.ts', 'const a = 1;\n// added explanatory comment\nconst b = 2;\n');
    const { code, out } = runNode(noAddedCommentsScript, ['--staged']);
    expect(code).not.toBe(0);
    expect(out).toContain('inlineViolationCount: 1');
    expect(out).toContain('added explanatory comment');
  });

  it('passes (exit 0) when no comment lines are added', () => {
    commitFile('f.ts', 'const a = 1;\n', 'base');
    stage('f.ts', 'const a = 1;\nconst b = 2;\n');
    const { code, out } = runNode(noAddedCommentsScript, ['--staged']);
    expect(code).toBe(0);
    expect(out).toContain('inlineViolationCount: 0');
  });

  it('allows added JSDoc doc comments (exit 0) and reports them separately', () => {
    commitFile('f.ts', 'export function f() {}\n', 'base');
    stage('f.ts', '/**\n * Documents f.\n * @returns nothing\n */\nexport function f() {}\n');
    const { code, out } = runNode(noAddedCommentsScript, ['--staged']);
    expect(code).toBe(0);
    expect(out).toContain('inlineViolationCount: 0');
    expect(out).toContain('docCommentCount: 4');
  });

  it('reports but exits 0 with --warn-only', () => {
    commitFile('f.ts', 'const a = 1;\n', 'base');
    stage('f.ts', 'const a = 1;\n// note\n');
    const { code, out } = runNode(noAddedCommentsScript, ['--staged', '--warn-only']);
    expect(code).toBe(0);
    expect(out).toContain('inlineViolationCount: 1');
  });

  it('skips non-code files like markdown', () => {
    stage('notes.md', '# heading\n');
    const { code, out } = runNode(noAddedCommentsScript, ['--staged']);
    expect(code).toBe(0);
    expect(out).toContain('inlineViolationCount: 0');
  });
});
