import { describe, expect, test } from 'bun:test';
import { runTreeTool } from '../../../src/mcp/tools/tree.js';

describe('runTreeTool', () => {
  test('returns text with token counts for src/types directory', async () => {
    const result = await runTreeTool({ path: 'src/types', depth: 0 });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('t');
    expect(text).toContain('src/types');
  });
});
