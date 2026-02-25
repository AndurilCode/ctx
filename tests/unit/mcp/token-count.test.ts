import { describe, expect, test } from 'bun:test';
import { runTokenCountTool } from '../../../src/mcp/tools/token-count.js';

describe('runTokenCountTool', () => {
  test('returns JSON with token count for text input', async () => {
    const result = await runTokenCountTool({ text: 'hello world' });
    const json = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(json.tokens).toBeGreaterThan(0);
    expect(json.bytes).toBe(11);
    expect(json.lines).toBe(1);
  });
});
