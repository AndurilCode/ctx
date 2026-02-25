import { describe, expect, test } from 'bun:test';
import { parseCliCustomRules, parseTimestampMode } from '../../../src/utils/log-options.js';

describe('parseTimestampMode', () => {
  test('accepts known modes', () => {
    expect(parseTimestampMode('auto')).toBe('auto');
    expect(parseTimestampMode('strip')).toBe('strip');
    expect(parseTimestampMode('keep')).toBe('keep');
  });

  test('falls back to auto for invalid values', () => {
    expect(parseTimestampMode('invalid')).toBe('auto');
  });
});

describe('parseCliCustomRules', () => {
  test('parses strip/fold/block values', () => {
    const rules = parseCliCustomRules('^DEBUG', '^warn', '^BEGIN$::^END$');
    expect(rules).toEqual([
      { type: 'strip', pattern: '^DEBUG' },
      { type: 'fold', pattern: '^warn', label: 'folded' },
      { type: 'block', start: '^BEGIN$', end: '^END$', label: 'block' },
    ]);
  });
});
