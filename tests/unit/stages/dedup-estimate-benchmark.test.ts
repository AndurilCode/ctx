import { describe, expect, test } from 'bun:test';
import { estimateTokens } from '../../../src/stages/dedup/scanner.js';

describe('dedup estimateTokens benchmark', () => {
  test('short word (<=7 chars) estimates 1 token', () => {
    expect(estimateTokens('boolean')).toBe(1); // 7 chars
    expect(estimateTokens('string')).toBe(1);  // 6 chars
    expect(estimateTokens('get')).toBe(1);     // 3 chars
  });

  test('medium word (8-10 chars) estimates 2 tokens', () => {
    expect(estimateTokens('interface')).toBe(2); // 9 chars
    expect(estimateTokens('typescript')).toBe(2); // 10 chars
    expect(estimateTokens('function')).toBe(2);  // 8 chars
  });

  test('long word (>10 chars) estimates ceil(length/5) tokens', () => {
    expect(estimateTokens('configuration')).toBe(Math.ceil(13 / 5)); // 3
    expect(estimateTokens('authentication')).toBe(Math.ceil(14 / 5)); // 3
  });

  test('phrase with mixed words sums correctly', () => {
    // "boolean interface" → 1 + 2 = 3
    expect(estimateTokens('boolean interface')).toBe(3);
  });

  test('single char returns at least 1', () => {
    expect(estimateTokens('a')).toBe(1);
  });
});
