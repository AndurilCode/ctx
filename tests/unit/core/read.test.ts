import { describe, expect, test } from 'bun:test';
import { budgetedRead } from '../../../src/core/read.js';
import { computeLineHashes } from '../../../src/parser/patch-line-edits.js';

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
    const result = await budgetedRead({
      file: 'package.json',
      maxTokens: 20,
      strategy: 'truncate',
    });
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

  test('lineHashes annotates each line with line number and hash', async () => {
    const content = 'line one\nline two\nline three';
    const result = await budgetedRead({
      file: 'test.txt',
      content,
      lineHashes: true,
    });
    const lines = result.content.split('\n');
    expect(lines).toHaveLength(3);
    // Each line should match the format: padded_number:hash| content
    for (const line of lines) {
      expect(line).toMatch(/^\s*\d+:[a-f0-9]{4}\| /);
    }
  });

  test('lineHashes produces 1-based line numbers', async () => {
    const content = 'alpha\nbeta';
    const result = await budgetedRead({
      file: 'test.txt',
      content,
      lineHashes: true,
    });
    const lines = result.content.split('\n');
    expect(lines[0]).toMatch(/^1:[a-f0-9]{4}\| alpha$/);
    expect(lines[1]).toMatch(/^2:[a-f0-9]{4}\| beta$/);
  });

  test('lineHashes match computeLineHashes output', async () => {
    const content = 'import foo\nexport bar\nconst baz = 1';
    const result = await budgetedRead({
      file: 'test.ts',
      content,
      lineHashes: true,
    });
    const expected = computeLineHashes(content);
    const lines = result.content.split('\n');
    for (let i = 0; i < expected.length; i++) {
      const eh = expected[i]!;
      expect(lines[i]).toContain(`:${eh.hash}| `);
      expect(lines[i]).toContain(eh.line);
    }
  });

  test('lineHashes pads line numbers for multi-digit files', async () => {
    const content = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = await budgetedRead({
      file: 'test.txt',
      content,
      lineHashes: true,
    });
    const lines = result.content.split('\n');
    // 12 lines → 2-digit padding, so line 1 should be padded
    expect(lines[0]).toMatch(/^ 1:[a-f0-9]{4}\| /);
    expect(lines[11]).toMatch(/^12:[a-f0-9]{4}\| /);
  });
});
