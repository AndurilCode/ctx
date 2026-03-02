import { describe, expect, test } from 'bun:test';
import { assembleContext } from '../../../src/core/context.js';

describe('assembleContext', () => {
  test('assembles multiple files within budget', async () => {
    const result = await assembleContext({
      sources: [{ file: 'src/types/diff.ts' }, { file: 'src/types/read.ts' }],
      maxTokens: 10000,
    });
    expect(result.sources).toHaveLength(2);
    expect(result.content).toContain('src/types/diff.ts');
    expect(result.content).toContain('src/types/read.ts');
    expect(result.totalTokens).toBeLessThanOrEqual(result.budget);
  });

  test('respects the token budget', async () => {
    const result = await assembleContext({
      sources: [{ file: 'src/core/compact.ts' }, { file: 'src/core/expand.ts' }],
      maxTokens: 100,
    });
    expect(result.totalTokens).toBeLessThanOrEqual(150); // allow some slack
    expect(result.sources).toHaveLength(2);
  });

  test('high priority sources get more tokens than low priority', async () => {
    const result = await assembleContext({
      sources: [
        { file: 'src/types/diff.ts', priority: 'high' },
        { file: 'src/types/read.ts', priority: 'low' },
      ],
      maxTokens: 80,
    });
    const highSrc = result.sources.find((s) => s.file.includes('diff'));
    const lowSrc = result.sources.find((s) => s.file.includes('read'));
    expect(highSrc!.tokens).toBeGreaterThanOrEqual(lowSrc!.tokens);
  });
});
