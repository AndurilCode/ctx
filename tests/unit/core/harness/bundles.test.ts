import { describe, expect, test } from 'bun:test';
import type { Bundle, BundleType } from '../../../../src/core/harness/bundles.js';
import { createBundle } from '../../../../src/core/harness/bundles.js';

describe('bundles (stub)', () => {
  test('createBundle returns a named empty bundle', () => {
    const b = createBundle('starter', 50_000);
    expect(b.type).toBe('starter');
    expect(b.tokenBudget).toBe(50_000);
    expect(b.files).toEqual([]);
  });

  test('all bundle types are valid', () => {
    const types: BundleType[] = ['starter', 'working', 'mutation-safety', 'anchor'];
    for (const t of types) {
      const b = createBundle(t, 1000);
      expect(b.type).toBe(t);
    }
  });
});
