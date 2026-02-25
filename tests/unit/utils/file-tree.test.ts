import { describe, expect, test } from 'bun:test';
import { buildFileTree } from '../../../src/utils/file-tree.js';

describe('buildFileTree', () => {
  test('builds a tree for the src/types directory', async () => {
    const { entries } = await buildFileTree({ path: 'src/types', depth: 0 });
    expect(entries.length).toBeGreaterThan(0);
    const fileEntries = entries.filter((e) => !e.isDirectory);
    expect(fileEntries.length).toBeGreaterThan(0);
  });

  test('respects glob filter for .ts files', async () => {
    const { entries } = await buildFileTree({ path: 'src/types', glob: '**/*.ts', depth: 0 });
    for (const entry of entries) {
      if (!entry.isDirectory) {
        expect(entry.name).toMatch(/\.ts$/);
      }
    }
  });

  test('respects depth limit of 0', async () => {
    const { entries } = await buildFileTree({ path: 'src', depth: 0 });
    for (const entry of entries) {
      expect(entry.children).toBeUndefined();
    }
  });
});
