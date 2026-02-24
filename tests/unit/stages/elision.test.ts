import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';
import { expand } from '../../../src/core/expand.js';

describe('elision stage', () => {
  const input = [
    '# Intro',
    '',
    'overview paragraph',
    '',
    '# Architecture',
    '',
    'system overview',
    '',
    '## Parsing Layer',
    '',
    'parser details',
    '',
    '# Roadmap',
    '',
    'future work',
    '',
  ].join('\n');

  test('keeps only matching sections and their child headings', () => {
    const { output } = compact(input, {
      versionMarker: false,
      onlySections: ['arch'],
    } as never);
    const restored = expand(output);

    expect(restored).toContain('# Architecture');
    expect(restored).toContain('## Parsing Layer');
    expect(restored).toContain('parser details');
    expect(restored).not.toContain('# Intro');
    expect(restored).not.toContain('# Roadmap');
  });

  test('strips matching sections and their child headings', () => {
    const { output } = compact(input, {
      versionMarker: false,
      stripSections: ['architecture'],
    } as never);
    const restored = expand(output);

    expect(restored).toContain('# Intro');
    expect(restored).toContain('# Roadmap');
    expect(restored).not.toContain('# Architecture');
    expect(restored).not.toContain('## Parsing Layer');
  });

  test('throws when onlySections and stripSections are both provided', () => {
    expect(() =>
      compact(input, {
        versionMarker: false,
        onlySections: ['architecture'],
        stripSections: ['roadmap'],
      } as never),
    ).toThrow(/mutually exclusive/i);
  });
});
