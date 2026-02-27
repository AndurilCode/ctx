import { describe, expect, test } from 'bun:test';
import { getChangedFiles } from '../../../src/utils/git.js';

describe('getChangedFiles', () => {
  test('returns array for valid diff base', () => {
    const files = getChangedFiles('.', 'HEAD');
    expect(Array.isArray(files)).toBe(true);
  });

  test('returns empty array for invalid diffBase', () => {
    const files = getChangedFiles('.', 'nonexistent-sha-xyz-abc-123');
    expect(files).toEqual([]);
  });
});
