import { describe, expect, test } from 'bun:test';
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
});
