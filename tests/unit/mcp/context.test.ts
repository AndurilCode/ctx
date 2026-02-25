import { describe, expect, test } from 'bun:test';
import { runContextTool } from '../../../src/mcp/tools/context.js';

describe('runContextTool', () => {
  test('assembles context from multiple sources', async () => {
    const result = await runContextTool({
      sources: [{ file: 'src/types/diff.ts' }, { file: 'src/types/read.ts' }],
      maxTokens: 5000,
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('src/types/diff.ts');
    expect(text).toContain('src/types/read.ts');
  });

  test('returns metadata as second content block', async () => {
    const result = await runContextTool({
      sources: [{ file: 'src/types/diff.ts' }],
      maxTokens: 5000,
    });
    expect(result.content.length).toBe(2);
    const meta = JSON.parse((result.content[1] as { type: string; text: string }).text);
    expect(meta.totalTokens).toBeGreaterThan(0);
    expect(meta.budget).toBe(5000);
    expect(Array.isArray(meta.sources)).toBe(true);
  });
});
