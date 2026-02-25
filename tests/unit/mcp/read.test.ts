import { describe, expect, test } from 'bun:test';
import { runReadTool } from '../../../src/mcp/tools/read.js';

describe('runReadTool', () => {
  test('returns full content for small file', async () => {
    const result = await runReadTool({ file: 'src/types/diff.ts' });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('DiffCompactOptions');
  });

  test('returns two content blocks (content + metadata)', async () => {
    const result = await runReadTool({ file: 'src/types/diff.ts', maxTokens: 10000 });
    expect(result.content.length).toBe(2);
    const meta = JSON.parse((result.content[1] as { type: string; text: string }).text);
    expect(meta.strategy).toBe('full');
    expect(meta.truncated).toBe(false);
  });
});
