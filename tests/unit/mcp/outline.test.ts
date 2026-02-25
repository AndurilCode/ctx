import { describe, expect, test } from 'bun:test';
import { runOutlineTool } from '../../../src/mcp/tools/outline.js';

describe('runOutlineTool', () => {
  test('returns text content for code input', async () => {
    const result = await runOutlineTool({
      code: ['function sum(a, b) {', '  return a + b;', '}', ''].join('\n'),
      language: 'javascript',
    });

    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Functions:');
    expect(text).toContain('sum');
  });
});
