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

  test('changedFiles boosts matching files in results', async () => {
    const result = await review({
      query: 'lock cache',
      glob: 'src/utils/*cache.ts',
      maxResults: 5,
      changedFiles: ['src/utils/discovery-cache.ts'],
    });
    const changed = result.files.find((f) => f.file.includes('discovery-cache'));
    expect(changed).toBeDefined();
  });

  test('changedFiles with zero query overlap still appear in results', async () => {
    const result = await review({
      query: 'completely unrelated xyzzy query',
      glob: 'src/utils/review-profiles.ts',
      maxResults: 5,
      changedFiles: ['src/utils/review-profiles.ts'],
    });
    const changed = result.files.find((f) => f.file.includes('review-profiles'));
    expect(changed).toBeDefined();
  });

  test('profile: docs restricts results to markdown files', async () => {
    const result = await review({
      query: 'study plan',
      profile: 'docs',
      maxResults: 5,
    });
    // When profile is 'docs', the effective glob should only match markdown
    expect(result.glob).toContain('md');
    // If any files are found, they should all be markdown
    for (const file of result.files) {
      expect(file.file).toMatch(/\.(md|mdx|markdown)$/);
    }
  });

  test('cluster: true groups flagged files by matched risk term', async () => {
    const result = await review({
      query: 'lock cache',
      glob: 'src/utils/*cache.ts',
      maxResults: 5,
      riskTerms: ['lock', 'cache'],
      cluster: true,
    });
    expect(result.clusters).toBeDefined();
    expect(Array.isArray(result.clusters)).toBe(true);
    const clusters = result.clusters ?? [];
    if (clusters.length > 0) {
      const first = clusters[0];
      expect(first?.term).toBeTruthy();
      expect(Array.isArray(first?.files)).toBe(true);
      expect(first?.count).toBe(first?.files.length);
    }
  });

  test('result includes cache metadata', async () => {
    const result = await review({
      query: 'lock cache',
      glob: 'src/utils/*cache.ts',
      maxResults: 2,
    });
    expect(result.cacheMetadata).toBeDefined();
    expect(typeof result.cacheMetadata!.hit).toBe('boolean');
    expect(result.cacheMetadata!.key).toBeTruthy();
  });

  test('evidence: true returns line-anchored snippets for flagged files', async () => {
    const result = await review({
      query: 'lock cache',
      glob: 'src/utils/*cache.ts',
      maxResults: 3,
      pass1Tokens: 400,
      pass2Tokens: 900,
      maxPass2Files: 1,
      riskTerms: ['withcachelock'],
      evidence: true,
    });

    const flagged = result.files.filter((f) => f.flagged);
    expect(flagged.length).toBeGreaterThan(0);
    for (const file of flagged) {
      expect(file.evidence).toBeDefined();
      const ev = file.evidence ?? [];
      expect(ev.length).toBeGreaterThan(0);
      const first = ev[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.lineNumber).toBeGreaterThan(0);
        expect(first.content).toBeTruthy();
        expect(first.matchedTerm).toBe('withcachelock');
      }
    }
  });
});
