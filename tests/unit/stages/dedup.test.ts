import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';

describe('dedup option (phase 1 behavior)', () => {
  test('is accepted and does not break compact output', () => {
    const input = '# Title\n\nrepeat repeat repeat';
    const { output } = compact(input, { dedup: true, versionMarker: false });
    expect(output).toContain(':1 Title');
  });
});
