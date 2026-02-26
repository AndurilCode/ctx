import { describe, expect, test } from 'bun:test';
import { computeIdfMap, scoreContentTermsBM25 } from '../../../src/utils/bm25.js';
import { queryTerms, scoreFile, scoreMetadataTerms } from '../../../src/utils/relevance.js';

describe('relevance benchmark: word-boundary matching', () => {
  test('short term "get" does not match symbol "target"', () => {
    const result = scoreMetadataTerms(['get'], 'foo.ts', ['target', 'budget', 'widget'], []);
    expect(result.score).toBe(0);
  });

  test('short term "get" does match symbol "getUser"', () => {
    const result = scoreMetadataTerms(['get'], 'foo.ts', ['getUser'], []);
    expect(result.score).toBeGreaterThan(0);
  });

  test('"get" does not match filename "budget.ts"', () => {
    const result = scoreMetadataTerms(['get'], 'budget.ts', [], []);
    expect(result.score).toBe(0);
  });

  test('"get" does match filename "get-user.ts"', () => {
    const result = scoreMetadataTerms(['get'], 'get-user.ts', [], []);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('relevance benchmark: per-signal score caps', () => {
  test('filename match is capped at +3 regardless of term count', () => {
    // 5 terms all match the filename — should still be capped at 3
    const terms = ['relevance', 'score', 'file', 'utils', 'helper'];
    const result = scoreMetadataTerms(terms, 'relevance-score-file-utils-helper.ts', [], []);
    expect(result.score).toBeLessThanOrEqual(3);
  });

  test('symbol matches are capped at +6 total', () => {
    const symbols = Array.from({ length: 10 }, (_, i) => `getUser${i}`);
    const result = scoreMetadataTerms(['get'], 'foo.ts', symbols, []);
    expect(result.score).toBeLessThanOrEqual(6);
  });

  test('heading matches are capped at +4 total', () => {
    const headings = Array.from({ length: 10 }, (_, i) => `Get User ${i}`);
    const result = scoreMetadataTerms(['get'], 'foo.ts', [], headings);
    expect(result.score).toBeLessThanOrEqual(4);
  });

  test('combined signals can exceed individual caps', () => {
    // filename(3) + symbols(6) + headings(4) = 13 max
    const result = scoreMetadataTerms(
      ['get'],
      'get.ts',
      Array.from({ length: 10 }, (_, i) => `getUser${i}`),
      Array.from({ length: 10 }, (_, i) => `Get Section ${i}`),
    );
    expect(result.score).toBeLessThanOrEqual(13);
    expect(result.score).toBeGreaterThan(3); // multiple signals contributed
  });
});

describe('relevance benchmark: camelCase query splitting', () => {
  test('queryTerms splits camelCase', () => {
    const terms = queryTerms('autoContext');
    expect(terms).toContain('auto');
    expect(terms).toContain('context');
  });

  test('queryTerms splits snake_case', () => {
    const terms = queryTerms('get_user');
    expect(terms).toContain('get');
    expect(terms).toContain('user');
  });

  test('camelCase query scores symbol match it would have missed before', () => {
    // "autoContext" splits to ["auto", "context"] — matches symbol "autoContext"
    const withCamel = scoreFile('autoContext', 'foo.ts', '', ['autoContext'], []);
    const withRaw = scoreMetadataTerms(['autocontext'], 'foo.ts', ['autoContext'], []);
    // After camelCase split, score should be higher (matches "auto" and "context" separately)
    expect(withCamel.score).toBeGreaterThan(withRaw.score);
  });
});

describe('relevance benchmark: path segment scoring', () => {
  test('utils/ directory boosts score over core/ for query "utils"', () => {
    const inUtils = scoreMetadataTerms(['utils'], 'src/utils/foo.ts', [], []);
    const inCore = scoreMetadataTerms(['utils'], 'src/core/foo.ts', [], []);
    expect(inUtils.score).toBeGreaterThan(inCore.score);
  });

  test('path segment score is capped at +2 even with multiple matching segments', () => {
    // "src" and "utils" both match — cap at 2
    const result = scoreMetadataTerms(['src', 'utils'], 'src/utils/foo.ts', [], []);
    expect(result.score).toBe(2); // cap is reached: both 'src' and 'utils' match
  });

  test('path segment match appears in matches array with "path:" prefix', () => {
    const result = scoreMetadataTerms(['utils'], 'src/utils/foo.ts', [], []);
    expect(result.matches.some((m) => m.startsWith('path:'))).toBe(true);
  });

  test('basename is not double-counted as path segment', () => {
    // 'foo' matches 'foo.ts' as a filename (score 3), not as a path segment
    const withBasenameOnly = scoreMetadataTerms(['foo'], 'foo.ts', [], []);
    expect(withBasenameOnly.score).toBe(3); // filename only
    expect(withBasenameOnly.matches.some((m) => m.startsWith('path:'))).toBe(false);

    // 'foo' in 'src/foo/' is a path segment match (score 1), 'bar.ts' is no match
    const withPath = scoreMetadataTerms(['foo'], 'src/foo/bar.ts', [], []);
    expect(withPath.score).toBe(1); // path segment only
    expect(withPath.matches.some((m) => m.startsWith('path:'))).toBe(true);
  });
});

describe('BM25 content scoring', () => {
  test('shorter document scores higher than longer for same term count', () => {
    const terms = ['compact'];
    const idfMap = new Map([['compact', Math.log(2)]]);
    const avgdl = 275; // midpoint between 50 and 500

    const shortContent = `compact compact compact ${'x'.repeat(47)}`; // ~71 chars
    const longContent = `compact compact compact ${'x'.repeat(497)}`; // ~521 chars

    const shortScore = scoreContentTermsBM25(terms, shortContent, idfMap, avgdl);
    const longScore = scoreContentTermsBM25(terms, longContent, idfMap, avgdl);

    expect(shortScore).toBeGreaterThan(longScore);
  });

  test('high-IDF term contributes more than low-IDF term', () => {
    const content = 'import compact import compact import compact';
    const avgdl = content.length;
    // "import" appears in 9 of 10 docs (common), "compact" in 1 of 10 (rare)
    const N = 10;
    const idfMap = new Map([
      ['import', Math.log((N - 9 + 0.5) / (9 + 0.5) + 1)], // low IDF ~0.07
      ['compact', Math.log((N - 1 + 0.5) / (1 + 0.5) + 1)], // high IDF ~1.9
    ]);

    const importScore = scoreContentTermsBM25(['import'], content, idfMap, avgdl);
    const compactScore = scoreContentTermsBM25(['compact'], content, idfMap, avgdl);

    expect(compactScore).toBeGreaterThan(importScore);
  });

  test('returns 0 for empty content', () => {
    const idfMap = new Map([['compact', 1]]);
    expect(scoreContentTermsBM25(['compact'], '', idfMap, 100)).toBe(0);
  });

  test('returns 0 for zero avgdl', () => {
    const idfMap = new Map([['compact', 1]]);
    expect(scoreContentTermsBM25(['compact'], 'compact', idfMap, 0)).toBe(0);
  });

  test('computeIdfMap returns higher IDF for rarer term', () => {
    const terms = ['rare', 'common'];
    const contents = [
      'rare term here',
      'common common common',
      'common appears again',
      'common once more',
    ];
    const { idfMap } = computeIdfMap(terms, contents);
    const rareIdf = idfMap.get('rare') ?? 0;
    const commonIdf = idfMap.get('common') ?? 0;
    expect(rareIdf).toBeGreaterThan(commonIdf);
  });

  test('computeIdfMap avgdl is mean char length of contents', () => {
    const { avgdl } = computeIdfMap([], ['ab', 'abcd']); // lengths 2 and 4
    expect(avgdl).toBe(3);
  });

  test('fallback IDF is used when term is not in idfMap', () => {
    // Term 'rare' not in idfMap — fallback IDF (Math.log(1.5)) should still produce a positive score
    const score = scoreContentTermsBM25(['rare'], 'rare rare rare', new Map(), 14);
    expect(score).toBeGreaterThan(0);
  });

  test('term in idfMap but absent from content contributes 0', () => {
    const idfMap = new Map([['compact', 2]]);
    const score = scoreContentTermsBM25(['compact'], 'no matches here', idfMap, 15);
    expect(score).toBe(0);
  });

  test('computeIdfMap returns sentinel avgdl:1 for empty corpus', () => {
    const { idfMap, avgdl } = computeIdfMap(['any'], []);
    expect(idfMap.size).toBe(0);
    expect(avgdl).toBe(1);
  });
});
