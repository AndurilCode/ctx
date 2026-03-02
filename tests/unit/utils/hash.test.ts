import { describe, expect, test } from 'bun:test';
import { hashString, shortHash } from '../../../src/utils/hash.js';

describe('shortHash', () => {
  test('returns a 4-char hex string by default', () => {
    const result = shortHash('hello world');
    expect(result).toHaveLength(4);
    expect(result).toMatch(/^[0-9a-f]{4}$/);
  });

  test('returns consistent results for same input', () => {
    expect(shortHash('test')).toBe(shortHash('test'));
  });

  test('returns different results for different input', () => {
    expect(shortHash('alpha')).not.toBe(shortHash('beta'));
  });

  test('respects custom length parameter', () => {
    const result = shortHash('hello', 2);
    expect(result).toHaveLength(2);
  });

  test('normalizes whitespace before hashing', () => {
    const a = shortHash('  function foo() {\n  return 1;\n}\n');
    const b = shortHash('function foo() {\n  return 1;\n}');
    expect(a).toBe(b);
  });

  test('normalizes line endings before hashing', () => {
    const a = shortHash('line1\r\nline2');
    const b = shortHash('line1\nline2');
    expect(a).toBe(b);
  });
});

describe('hashString', () => {
  test('returns full sha256 hex', () => {
    const result = hashString('test');
    expect(result).toHaveLength(64);
  });
});
