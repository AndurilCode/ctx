import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';
import { expand } from '../../../src/core/expand.js';

describe('semantic stage', () => {
  test('normalizes smart punctuation when semantic mode is enabled', () => {
    const input = '# Title\n\n“Smart” text — with ellipsis… and non-breaking\u00a0space.';
    const { output } = compact(input, { semantic: true, versionMarker: false });

    expect(output).toContain('"Smart" text -- with ellipsis... and non-breaking space.');
  });

  test('preserves source punctuation when semantic mode is disabled', () => {
    const input = '# Title\n\n“Smart” text — with ellipsis… and non-breaking\u00a0space.';
    const { output } = compact(input, { semantic: false, versionMarker: false });
    expect(output).toContain('“Smart” text — with ellipsis… and non-breaking\u00a0space.');
  });

  test('strips html comments in semantic mode when keepComments is false', () => {
    const input = '# Title\n\n<!-- internal -->\n\nParagraph.';
    const { output } = compact(input, {
      semantic: true,
      keepComments: false,
      versionMarker: false,
    });
    const restored = expand(output);

    expect(output).not.toContain('<!-- internal -->');
    expect(restored).not.toContain('<!-- internal -->');
  });
});
