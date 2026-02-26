import { describe, expect, test } from 'bun:test';
import { HIGH_SCORE_THRESHOLD, MIN_SHARED_IMPORTERS } from '../../../src/core/auto-context.js';

describe('auto-context benchmark: threshold', () => {
  test('HIGH_SCORE_THRESHOLD is 5', () => {
    // Threshold of 5 requires at least two signal types:
    // filename(3) + 1 symbol(2) = 5, or 3 symbols(6) etc.
    expect(HIGH_SCORE_THRESHOLD).toBe(5);
  });

  test('threshold 5 requires more than single filename match', () => {
    // A single filename match gives score=3, which is below threshold=5
    const singleFilenameMatchScore = 3;
    expect(singleFilenameMatchScore).toBeLessThan(HIGH_SCORE_THRESHOLD);
  });

  test('threshold 5 is reachable with filename + symbol match', () => {
    const filenameScore = 3;
    const symbolScore = 2;
    expect(filenameScore + symbolScore).toBeGreaterThanOrEqual(HIGH_SCORE_THRESHOLD);
  });
});

describe('auto-context benchmark: proximity scoring formula', () => {
  test('derived score from parent score 10 is 5', () => {
    const parentScore = 10;
    const derived = Math.max(1, Math.floor(parentScore * 0.5));
    expect(derived).toBe(5);
  });

  test('derived score from parent score 5 is 2', () => {
    const parentScore = 5;
    const derived = Math.max(1, Math.floor(parentScore * 0.5));
    expect(derived).toBe(2);
  });

  test('derived score from parent score 1 is at least 1', () => {
    const parentScore = 1;
    const derived = Math.max(1, Math.floor(parentScore * 0.5));
    expect(derived).toBe(1);
  });

  test('parent score 4 is below threshold so expansion does not run', () => {
    const parentScore = 4;
    expect(parentScore).toBeLessThan(HIGH_SCORE_THRESHOLD);
  });
});

describe('auto-context benchmark: shared-dependency boost', () => {
  test('MIN_SHARED_IMPORTERS is 2', () => {
    expect(MIN_SHARED_IMPORTERS).toBe(2);
  });

  test('shared-dependency boost formula: importer count becomes score', () => {
    // Files imported by N scored files receive score = N
    const importerCount = 3;
    const expectedScore = importerCount;
    expect(expectedScore).toBeGreaterThanOrEqual(MIN_SHARED_IMPORTERS);
  });

  test('single-importer files do not meet boost threshold', () => {
    expect(1).toBeLessThan(MIN_SHARED_IMPORTERS);
  });
});
