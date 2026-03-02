import { describe, expect, test } from 'bun:test';
import { runChangeVerifyTool } from '../../../src/mcp/tools/change-verify.js';

describe('runChangeVerifyTool', () => {
  test('returns JSON verify payload', async () => {
    const result = await runChangeVerifyTool({
      file: 'src/core/verify.ts',
      symbol: 'verify',
      since: '0000',
    });
    const payload = JSON.parse((result.content[0] as { type: string; text: string }).text) as {
      mode: string;
      output: string;
    };

    expect(payload.mode).toBe('plan');
    expect(payload.output).toContain('── verify plan');
  });
});
