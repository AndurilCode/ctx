import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';

describe('semantic option (phase 1 behavior)', () => {
  test('is accepted and keeps compact pipeline stable', () => {
    const input = '# Title\n\nParagraph text.';
    const { output } = compact(input, { semantic: true, versionMarker: false });
    expect(output).toContain(':1 Title');
  });
});
