import { describe, expect, test } from 'bun:test';
import { runFocusTool } from '../../../src/mcp/tools/focus.js';

describe('runFocusTool', () => {
  test('returns JSON focus payload', async () => {
    const result = await runFocusTool({
      file: 'src/core/verify.ts',
      symbol: 'verify',
      maxTokens: 600,
    });

    const payload = JSON.parse((result.content[0] as { type: string; text: string }).text) as {
      output: string;
      symbol: string;
    };

    expect(payload.symbol).toBe('verify');
    expect(payload.output).toContain('focus: verify');
  });
});
