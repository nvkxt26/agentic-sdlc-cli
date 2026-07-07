import { describe, expect, it } from 'vitest';
import { toToon } from './toon.js';

describe('toToon', () => {
  it('encodes primitive arrays in compact form', () => {
    const out = toToon({ labels: ['backend', 'urgent'] });
    expect(out).toBe('labels[2]: backend,urgent');
  });

  it('encodes uniform object arrays in tabular form', () => {
    const out = toToon({
      steps: [
        { order: 1, file: 'src/a.ts', change: 'add retry' },
        { order: 2, file: 'src/b.ts', change: 'add test' },
      ],
    });

    expect(out).toBe(
      [
        'steps[2]{order,file,change}:',
        '  1,src/a.ts,"add retry"',
        '  2,src/b.ts,"add test"',
      ].join('\n'),
    );
  });

  it('quotes string scalars when needed', () => {
    const out = toToon({ summary: 'add retry: payments' });
    expect(out).toBe('summary: "add retry: payments"');
  });
});
