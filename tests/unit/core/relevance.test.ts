import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  test('keeps content-only matches even without filename/symbol/heading matches', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-relevance-'));
    const fileA = join(dir, 'alpha.ts');
    const fileB = join(dir, 'beta.ts');

    try {
      await writeFile(fileA, 'export const value = 1;', 'utf8');
      await writeFile(fileB, 'const note = "zzztargetterm appears only in plain content";', 'utf8');
      const result = await relevance({
        query: 'zzztargetterm',
        files: [fileA, fileB],
      });
      expect(result.results.some((match) => match.file === fileB)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
