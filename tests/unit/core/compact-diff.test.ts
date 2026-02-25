import { describe, expect, test } from 'bun:test';
import { compactDiff } from '../../../src/core/compact-diff.js';

describe('compactDiff', () => {
  test('returns compacted unified diff output', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      'index 1..2 100644',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n');

    const output = compactDiff(diff);
    expect(output).toContain('=== a.ts');
    expect(output).toContain('-old');
    expect(output).toContain('+new');
  });
});
