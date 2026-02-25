import { describe, expect, test } from 'bun:test';
import { runImportsTool } from '../../../src/mcp/tools/imports.js';

describe('runImportsTool', () => {
  test('returns outgoing imports as text', async () => {
    const result = await runImportsTool({ file: 'src/core/compact.ts', direction: 'outgoing' });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('src/core/compact.ts');
    expect(text).toContain('Imports (outgoing)');
  });
});
