import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _resetRelevanceCacheForTesting,
  commitRelevanceMetadata,
  getRelevanceMetadata,
  setRelevanceMetadata,
} from '../../../src/utils/relevance-cache.js';

describe('relevance cache', () => {
  afterEach(() => {
    _resetRelevanceCacheForTesting();
  });

  test('returns cached metadata for unchanged file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-relcache-'));
    const cachePath = join(dir, 'cache.json');
    const file = join(dir, 'sample.ts');

    try {
      _resetRelevanceCacheForTesting(cachePath);
      await writeFile(file, 'export function run() {}', 'utf8');
      await setRelevanceMetadata(file, ['run'], ['Heading']);
      commitRelevanceMetadata();

      const cached = await getRelevanceMetadata(file);
      expect(cached).toBeDefined();
      expect(cached?.symbols).toContain('run');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('invalidates metadata after file changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-relcache-'));
    const cachePath = join(dir, 'cache.json');
    const file = join(dir, 'sample.ts');

    try {
      _resetRelevanceCacheForTesting(cachePath);
      await writeFile(file, 'export function one() {}', 'utf8');
      await setRelevanceMetadata(file, ['one'], ['Heading']);
      commitRelevanceMetadata();

      await writeFile(file, 'export function two() {}', 'utf8');
      const cached = await getRelevanceMetadata(file);
      expect(cached).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
