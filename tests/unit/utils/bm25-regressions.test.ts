import { describe, expect, test } from 'bun:test';
import { computeIdfMap, scoreContentTermsBM25 } from '../../../src/utils/bm25.js';

describe('BM25 word-boundary regressions', () => {
  test('"get" scores 0 in "budget target widget" (no word-boundary match)', () => {
    const terms = ['get'];
    const content = 'budget target widget';
    const { idfMap, avgdl } = computeIdfMap(terms, [content]);
    const score = scoreContentTermsBM25(terms, content, idfMap, avgdl);
    expect(score).toBe(0);
  });

  test('"get" scores >0 in "get the value" (word-boundary match)', () => {
    const terms = ['get'];
    const content = 'get the value';
    const { idfMap, avgdl } = computeIdfMap(terms, [content]);
    const score = scoreContentTermsBM25(terms, content, idfMap, avgdl);
    expect(score).toBeGreaterThan(0);
  });

  test('code file with long identifiers not penalized vs prose with same word count', () => {
    const terms = ['parse'];
    const codeContent = 'parseAbstractSyntaxTreeNode parseConfigurationValue parse';
    const proseContent = 'parse the file and parse it again then parse';
    // Both have similar word counts; code file has longer tokens but same # of words
    const { idfMap, avgdl } = computeIdfMap(terms, [codeContent, proseContent]);

    const codeScore = scoreContentTermsBM25(terms, codeContent, idfMap, avgdl);
    const proseScore = scoreContentTermsBM25(terms, proseContent, idfMap, avgdl);

    // With word-based length, code file should not be unfairly penalized
    // Both have 3 matches of "parse" (via word-boundary) and similar word counts
    expect(codeScore).toBeGreaterThan(0);
    expect(Math.abs(codeScore - proseScore)).toBeLessThan(proseScore * 0.5);
  });
});
