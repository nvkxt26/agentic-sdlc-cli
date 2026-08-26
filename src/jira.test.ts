import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jiraScript = join(repoRoot, 'templates/skills/jira/scripts/jira.mjs');

function runJira(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync('node', [jiraScript, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env },
    });
    return { code: 0, out };
  } catch (e: any) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('jira skill --sprint / --jql', () => {
  it('requires at least one selector flag', () => {
    const { code, out } = runJira([]);
    expect(code).not.toBe(0);
    expect(out).toContain('error:');
    expect(out).toContain('missing --issue');
  });

  it('fails when env vars are missing (sprint mode)', () => {
    const { code, out } = runJira(['--sprint', 'active']);
    expect(code).not.toBe(0);
    expect(out).toContain('error:');
  });

  it('fails when env vars are missing (jql mode)', () => {
    const { code, out } = runJira(['--jql', 'assignee = currentUser()']);
    expect(code).not.toBe(0);
    expect(out).toContain('error:');
  });

  it('emits TOON error format on missing env vars', () => {
    const { code, out } = runJira(['--sprint', 'active']);
    expect(code).not.toBe(0);
    expect(out).toContain('error:');
    expect(out).toContain('skill: jira');
    expect(out).toContain('message:');
  });

  it('emits TOON error format with proper structure on invalid selector', () => {
    const { code, out } = runJira([]);
    expect(code).not.toBe(0);
    const lines = out.trim().split('\n');
    expect(lines.some((l) => l.includes('error:'))).toBe(true);
    expect(lines.some((l) => l.includes('skill: jira'))).toBe(true);
  });
});

describe('buildJql logic (via dynamic import)', () => {
  it('sprint numeric → "sprint = N AND assignee = currentUser() ORDER BY"', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ sprint: '123' });
    expect(jql).toBe('sprint = 123 AND assignee = currentUser() ORDER BY priority DESC, created ASC');
  });

  it('sprint active → "sprint in openSprints() AND assignee = currentUser() ORDER BY"', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ sprint: 'active' });
    expect(jql).toBe('sprint in openSprints() AND assignee = currentUser() ORDER BY priority DESC, created ASC');
  });

  it('raw jql without order by → appends ORDER BY', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ jql: 'assignee = currentUser() AND status \!= Done' });
    expect(jql).toBe('assignee = currentUser() AND status \!= Done ORDER BY priority DESC, created ASC');
  });

  it('raw jql with existing order by → passthrough unchanged', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ jql: 'project = ABC ORDER BY created DESC' });
    expect(jql).toBe('project = ABC ORDER BY created DESC');
  });

  it('raw jql with case-insensitive "order by" → passthrough unchanged', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ jql: 'status = "In Progress" Order By updated ASC' });
    expect(jql).toBe('status = "In Progress" Order By updated ASC');
  });

  it('assignee override → replaces currentUser()', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ sprint: '456', assignee: 'john.doe' });
    expect(jql).toBe('sprint = 456 AND assignee = john.doe ORDER BY priority DESC, created ASC');
  });

  it('assignee-only (no sprint) → "assignee = X ORDER BY"', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ assignee: 'jane.smith' });
    expect(jql).toBe('assignee = jane.smith ORDER BY priority DESC, created ASC');
  });

  it('throws when sprint value is invalid', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(() => mod.buildJql({ sprint: 'invalid' })).toThrow('invalid sprint value');
  });

  it('empty sprint value → fallback to assignee-only', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ sprint: '' });
    expect(jql).toBe('assignee = currentUser() ORDER BY priority DESC, created ASC');
  });

  it('raw jql with mixed-case "OrDeR bY" → passthrough unchanged', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ jql: 'priority = High OrDeR bY created DESC' });
    expect(jql).toBe('priority = High OrDeR bY created DESC');
  });

  it('board parameter is currently ignored (no-op)', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({ board: '123', assignee: 'test.user' });
    expect(jql).toBe('assignee = test.user ORDER BY priority DESC, created ASC');
  });

  it('no parameters → defaults to "assignee = currentUser() ORDER BY"', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const jql = mod.buildJql({});
    expect(jql).toBe('assignee = currentUser() ORDER BY priority DESC, created ASC');
  });
});

describe('self-learning custom-field helpers', () => {
  it('matchAcceptanceFields → only custom fields whose name matches /acceptance/i', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const defs = [
      { id: 'summary', name: 'Summary', custom: false },
      { id: 'customfield_10903', name: 'Acceptance Criteria', custom: true },
      { id: 'customfield_10001', name: 'Story Points', custom: true },
      { id: 'customfield_20000', name: 'ACCEPTANCE notes', custom: true },
      { id: 'customfield_30000', name: 'Acceptance Criteria', custom: false },
    ];
    expect(mod.matchAcceptanceFields(defs)).toEqual(['customfield_10903', 'customfield_20000']);
  });

  it('matchAcceptanceFields → empty/undefined defs → []', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.matchAcceptanceFields(undefined)).toEqual([]);
    expect(mod.matchAcceptanceFields([])).toEqual([]);
  });

  it('parseFieldValue → plain string trimmed', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.parseFieldValue('  hi there  ')).toBe('hi there');
  });

  it('parseFieldValue → null/undefined → ""', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.parseFieldValue(null)).toBe('');
    expect(mod.parseFieldValue(undefined)).toBe('');
  });

  it('parseFieldValue → option object uses .value', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.parseFieldValue({ value: 'High', id: '1' })).toBe('High');
  });

  it('parseFieldValue → array joins non-empty with "; "', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.parseFieldValue([{ value: 'A' }, { value: '' }, { value: 'B' }])).toBe('A; B');
  });

  it('parseFieldValue → ADF doc flattens to text', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Given a user' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Then it works' }] },
      ],
    };
    expect(mod.parseFieldValue(adf)).toBe('Given a user\nThen it works');
  });

  it('mergeLearned → prepends new id, dedupes, learned-first', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.mergeLearned(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    expect(mod.mergeLearned(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(mod.mergeLearned(undefined, 'x')).toEqual(['x']);
    expect(mod.mergeLearned(['a'], '')).toEqual(['a']);
  });

  it('hostKey → derives host from base url, falls back gracefully', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.hostKey('https://acme.atlassian.net')).toBe('acme.atlassian.net');
    expect(mod.hostKey('not-a-url')).toBe('not-a-url');
  });

  it('loadFieldCache → missing file → {}', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.loadFieldCache('/nonexistent/dir/does-not-exist.json')).toEqual({});
  });
});

describe('workflow transition helpers', () => {
  const trs = [
    { id: '11', name: 'Start Progress', to: { id: '2', name: 'In Progress' } },
    { id: '21', name: 'Select', to: { id: '3', name: 'Selected for Development' } },
    { id: '31', name: 'Back', to: { id: '1', name: 'To Do' } },
  ];

  it('normalizeStatus → trims + lowercases', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.normalizeStatus('  In Progress ')).toBe('in progress');
    expect(mod.normalizeStatus(null)).toBe('');
    expect(mod.normalizeStatus(undefined)).toBe('');
  });

  it('findDirectTransition → matches target status name case-insensitively', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.findDirectTransition(trs, 'in progress')).toMatchObject({ id: '11' });
    expect(mod.findDirectTransition(trs, 'Done')).toBeNull();
    expect(mod.findDirectTransition([], 'In Progress')).toBeNull();
  });

  it('chooseNextTransition → prefers direct hop to target', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    expect(mod.chooseNextTransition(trs, 'In Progress')).toMatchObject({ id: '11' });
  });

  it('chooseNextTransition → falls back to first unvisited target when no direct', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const next = mod.chooseNextTransition(trs, 'Done', new Set(['to do']));
    expect(next).toMatchObject({ id: '11' });
  });

  it('chooseNextTransition → skips already-visited targets', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const next = mod.chooseNextTransition(trs, 'Done', new Set(['in progress', 'selected for development']));
    expect(next).toMatchObject({ id: '31' });
  });

  it('chooseNextTransition → null when every target visited and none direct', async () => {
    const mod = await import('../templates/skills/jira/scripts/jira.mjs');
    const visited = new Set(['in progress', 'selected for development', 'to do']);
    expect(mod.chooseNextTransition(trs, 'Done', visited)).toBeNull();
  });
});
