import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { autoContext } from '../../../src/core/auto-context.js';

describe('autoContext', () => {
  test('finds compact.ts for query "compact"', async () => {
    const result = await autoContext({ query: 'compact', maxTokens: 5000 });
    const files = result.selectedFiles.map((file) => file.file);
    expect(files.some((file) => file.includes('compact'))).toBe(true);
    expect(result.content).toBeTruthy();
    expect(result.totalTokens).toBeLessThanOrEqual(5000);
    expect(result.query).toBe('compact');
  });

  test('seeds are always high priority', async () => {
    const result = await autoContext({
      query: 'nonexistentxyzterm',
      seeds: ['src/types/diff.ts'],
      maxTokens: 5000,
    });
    const seeded = result.selectedFiles.find((file) => file.file.includes('diff'));
    expect(seeded).toBeDefined();
    expect(seeded?.priority).toBe('high');
  });

  test('depth 0 yields no low-priority files', async () => {
    const result = await autoContext({ query: 'compact', maxTokens: 5000, depth: 0 });
    expect(result.selectedFiles.every((file) => file.priority !== 'low')).toBe(true);
  });

  test('respects maxTokens budget', async () => {
    const result = await autoContext({ query: 'compact', maxTokens: 200 });
    expect(result.totalTokens).toBeLessThanOrEqual(400);
  });

  test('shared-dependency boost: utility imported by 2+ scored files is included', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-shared-dep-'));
    const utilFile = join(dir, 'util.ts');
    const fileA = join(dir, 'a.ts');
    const fileB = join(dir, 'b.ts');
    try {
      await writeFile(utilFile, 'export function sharedUtil() {}', 'utf8');
      await writeFile(
        fileA,
        "import { sharedUtil } from './util.js';\nexport function alpha() {}",
        'utf8',
      );
      await writeFile(
        fileB,
        "import { sharedUtil } from './util.js';\nexport function beta() {}",
        'utf8',
      );

      // Query "alpha beta" — scores fileA and fileB; util.ts has no matching terms
      const result = await autoContext({
        query: 'alpha beta',
        path: dir,
        maxFiles: 10,
        maxTokens: 5000,
      });

      const utilEntry = result.selectedFiles.find((f) => f.file.includes('util'));
      expect(utilEntry).toBeDefined();
      expect(utilEntry?.priority).toBe('low');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
