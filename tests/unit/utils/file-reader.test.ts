import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetFileTextCacheForTesting, readFileText } from '../../../src/utils/file-reader.js';

describe('readFileText cache', () => {
  afterEach(() => {
    _resetFileTextCacheForTesting();
  });

  test('returns latest content after file changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ctx-reader-'));
    const file = join(dir, 'sample.txt');

    try {
      await writeFile(file, 'one', 'utf8');
      const first = await readFileText(file);
      expect(first).toBe('one');

      await writeFile(file, 'two', 'utf8');
      const second = await readFileText(file);
      expect(second).toBe('two');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
