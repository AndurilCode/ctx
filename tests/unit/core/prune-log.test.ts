import { describe, expect, test } from 'bun:test';
import { pruneLog } from '../../../src/core/prune-log.js';

describe('pruneLog', () => {
  test('returns pruning stats and output', () => {
    const input = ['✓ test one', '✗ test two'].join('\n');
    const result = pruneLog(input);

    expect(result.output).toContain('✗ test two');
    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.prunedTokens).toBeGreaterThan(0);
  });

  test('uses injected token counter for no-regression decisions', () => {
    const input = ['✓ test one', '✓ test two', '✗ test three', 'Tests: 2 passed, 1 failed'].join(
      '\n',
    );
    const counter = {
      count(text: string): number {
        if (text.includes('[tests pruned:')) return 10;
        return 9;
      },
    };

    const result = pruneLog(input, { allowTokenExpansion: false, tokenCounter: counter });
    expect(result.output).toBe(input);
    expect(result.pruned).toBe(false);
  });
});
