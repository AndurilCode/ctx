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
    const dir = await mkdtemp(join(tmpdir(), 'ctx-relevance-'));
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

  test('BM25: shorter file with same term count ranks above longer file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ctx-bm25-'));
    const shortFile = join(dir, 'short.ts');
    const longFile = join(dir, 'long.ts');
    try {
      // Same 3 occurrences of "compact", but very different document lengths
      await writeFile(shortFile, 'compact compact compact', 'utf8');
      await writeFile(longFile, `compact compact compact ${'padding '.repeat(200)}`, 'utf8');

      // longFile is listed first so that without BM25 normalisation the stable sort
      // would leave it ranked first (equal raw counts preserve insertion order).
      const result = await relevance({
        query: 'compact',
        files: [longFile, shortFile],
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.file).toBe(shortFile);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
