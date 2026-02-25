import { describe, expect, test } from 'bun:test';
import { relevance } from '../../../src/core/relevance.js';

describe('relevance', () => {
  test('ranks files by query match — tokens.ts should rank first for "token counter"', async () => {
    const result = await relevance({
      query: 'token counter',
      files: ['src/utils/tokens.ts', 'src/types/diff.ts', 'src/types/tree.ts'],
    });
    expect(result.results.length).toBeGreaterThan(0);
    const top = result.results[0]!;
    expect(top.file).toContain('tokens');
    expect(top.score).toBeGreaterThan(0);
  });

  test('respects maxResults', async () => {
    const result = await relevance({
      query: 'compact',
      files: ['src/core/compact.ts', 'src/core/expand.ts', 'src/core/verify.ts'],
      maxResults: 1,
    });
    expect(result.results).toHaveLength(1);
  });

  test('returns empty results for no matches', async () => {
    const result = await relevance({
      query: 'xyzzznonexistentterm',
      files: ['src/types/diff.ts'],
    });
    expect(result.results).toHaveLength(0);
  });
});
