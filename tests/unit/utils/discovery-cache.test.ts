import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _getDiscoveryCacheStatsForTesting,
  _resetDiscoveryCacheForTesting,
  discoverFilesCached,
} from '../../../src/utils/discovery-cache.js';

describe('discovery cache', () => {
  afterEach(() => {
    _resetDiscoveryCacheForTesting();
  });

  test('hits cache on repeated calls with unchanged tree', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-discovery-'));
    const cachePath = join(tmpdir(), `compact-md-discovery-cache-${Date.now()}-1.json`);

    try {
      await mkdir(join(dir, 'src'));
      await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 1;', 'utf8');
      await writeFile(join(dir, 'src', 'b.ts'), 'export const b = 2;', 'utf8');
      _resetDiscoveryCacheForTesting(cachePath);

      const first = await discoverFilesCached({
        root: dir,
        globPattern: '**/*.ts',
        ignore: ['node_modules/**'],
      });
      const second = await discoverFilesCached({
        root: dir,
        globPattern: '**/*.ts',
        ignore: ['node_modules/**'],
      });

      expect(first.sort()).toEqual(second.sort());
      const stats = _getDiscoveryCacheStatsForTesting();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('invalidates when a new file is added', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'compact-md-discovery-'));
    const cachePath = join(tmpdir(), `compact-md-discovery-cache-${Date.now()}-2.json`);

    try {
      await mkdir(join(dir, 'src'));
      await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 1;', 'utf8');
      _resetDiscoveryCacheForTesting(cachePath);

      await discoverFilesCached({
        root: dir,
        globPattern: '**/*.ts',
        ignore: ['node_modules/**'],
      });
      await writeFile(join(dir, 'src', 'new.ts'), 'export const n = 1;', 'utf8');

      const next = await discoverFilesCached({
        root: dir,
        globPattern: '**/*.ts',
        ignore: ['node_modules/**'],
      });

      expect(next.some((file) => file.endsWith('new.ts'))).toBe(true);
      const stats = _getDiscoveryCacheStatsForTesting();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
