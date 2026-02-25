import { describe, expect, test } from 'bun:test';
import { tree } from '../../../src/core/tree.js';

describe('tree', () => {
  test('returns formatted output with token counts', async () => {
    const result = await tree({ path: 'src/types', depth: 0 });
    expect(result.totalFiles).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.output).toContain('t');
  });

  test('root is an absolute path', async () => {
    const result = await tree({ path: 'src/types' });
    expect(result.root).toMatch(/^\//);
  });
});
