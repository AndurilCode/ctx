import { describe, expect, test } from 'bun:test';
import { runSymbolsTool } from '../../../src/mcp/tools/symbols.js';

describe('runSymbolsTool', () => {
  test('finds symbol definitions and returns text output', async () => {
    const result = await runSymbolsTool({
      query: 'TokenCountOptions',
      path: 'src/types',
      glob: '**/*.ts',
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('TokenCountOptions');
    expect(text).toContain('Defined in');
  });
});
