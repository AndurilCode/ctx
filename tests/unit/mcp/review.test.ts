import { describe, expect, test } from 'bun:test';
import { runReviewTool } from '../../../src/mcp/tools/review.js';

describe('runReviewTool', () => {
  test('returns JSON two-pass report', async () => {
    const result = await runReviewTool({
      query: 'lock cache',
      glob: 'src/utils/*cache.ts',
      maxResults: 2,
      pass1Tokens: 180,
      pass2Tokens: 800,
      maxPass2Files: 1,
      riskTerms: ['withcachelock'],
    });

    const payload = JSON.parse((result.content[0] as { type: string; text: string }).text) as {
      files: Array<{ file: string }>;
      totals: { pass1Tokens: number };
    };

    expect(payload.files.length).toBeGreaterThan(0);
    expect(payload.totals.pass1Tokens).toBeGreaterThan(0);
  });
});
