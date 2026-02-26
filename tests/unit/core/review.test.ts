import { describe, expect, test } from 'bun:test';
import { review } from '../../../src/core/review.js';

describe('review', () => {
  test('returns two-pass report with bounded pass-2 files', async () => {
    const result = await review({
      query: 'lock cache',
      glob: 'src/utils/*cache.ts',
      maxResults: 3,
      pass1Tokens: 180,
      pass2Tokens: 900,
      maxPass2Files: 1,
      riskTerms: ['withcachelock'],
    });

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.totals.fullTokens).toBeGreaterThan(0);
    expect(result.totals.pass2Files).toBeLessThanOrEqual(1);
    expect(result.totals.twoPassTokens).toBe(result.totals.pass1Tokens + result.totals.pass2Tokens);
    expect(result.totals.savedTokens).toBe(result.totals.fullTokens - result.totals.twoPassTokens);
    expect(result.root.length).toBeGreaterThan(0);
  });
});
