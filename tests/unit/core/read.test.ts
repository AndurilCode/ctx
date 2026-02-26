import { describe, expect, test } from 'bun:test';
import { budgetedRead } from '../../../src/core/read.js';

describe('budgetedRead', () => {
  test('returns full content when file fits within budget', async () => {
    const result = await budgetedRead({ file: 'src/types/diff.ts', maxTokens: 10000 });
    expect(result.strategy).toBe('full');
    expect(result.truncated).toBe(false);
    expect(result.content.length).toBeGreaterThan(0);
  });

  test('returns full content when no budget specified', async () => {
    const result = await budgetedRead({ file: 'src/types/diff.ts' });
    expect(result.strategy).toBe('full');
    expect(result.truncated).toBe(false);
  });

  test('falls back to outline for ts code files over budget', async () => {
    const result = await budgetedRead({ file: 'src/core/compact.ts', maxTokens: 10 });
    expect(['outline', 'truncate']).toContain(result.strategy);
    expect(result.truncated).toBe(true);
    expect(result.returnedTokens).toBeLessThanOrEqual(15); // some slack for outline format
  });

  test('truncates when strategy is explicitly truncate', async () => {
    const result = await budgetedRead({ file: 'package.json', maxTokens: 20, strategy: 'truncate' });
    expect(result.strategy).toBe('truncate');
    expect(result.content).toContain('[...truncated');
  });

  test('treats .json files as code files (auto strategy, over budget)', async () => {
    // package.json is a real .json file in the repo
    const result = await budgetedRead({ file: 'package.json', maxTokens: 5 });
    // With maxTokens: 5, any real file will exceed budget
    // auto strategy should pick outline or fall back to truncate — never 'full' or 'sections'
    expect(['outline', 'truncate']).toContain(result.strategy);
    expect(result.truncated).toBe(true);
  });

  test('treats .yaml files as code files (auto strategy, over budget)', async () => {
    // Use inline content with a .yaml filename so no real file is needed
    const result = await budgetedRead({
      file: 'fake.yaml',
      content:
        'name: test\nversion: 1.0.0\ndescription: a test yaml file with enough content to exceed a small token budget for verification purposes',
      maxTokens: 5,
    });
    expect(['outline', 'truncate']).toContain(result.strategy);
    expect(result.truncated).toBe(true);
  });
});
