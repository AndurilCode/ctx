import { describe, expect, test } from 'vitest';
import { verify } from '../../../src/core/verify.js';

describe('verify', () => {
  test('returns true for a stable markdown round-trip', () => {
    const markdown = '# Title\n\n- [ ] todo\n\n| A | B |\n| - | - |\n| 1 | 2 |\n';
    expect(verify(markdown)).toBe(true);
  });
});
