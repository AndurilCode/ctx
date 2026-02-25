import { describe, expect, test } from 'bun:test';
import { runRelevanceTool } from '../../../src/mcp/tools/relevance.js';

describe('runRelevanceTool', () => {
  test('returns ranked results as JSON', async () => {
    const result = await runRelevanceTool({
      query: 'token counter',
      files: ['src/utils/tokens.ts', 'src/types/diff.ts'],
    });
    const json = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(json.results).toBeDefined();
    expect(json.results[0].file).toContain('tokens');
  });
});
