import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';
import { expand } from '../../../src/core/expand.js';

describe('unwrap stage', () => {
  test('collapses soft line breaks within paragraphs', () => {
    const input = '# Title\n\nline one\nline two\nline three\n';
    const { output } = compact(input, { unwrapLines: true, versionMarker: false } as never);
    const restored = expand(output);

    expect(restored).toContain('line one line two line three');
  });

  test('does not affect code blocks or headings', () => {
    const input = '# Header\n\nline one\nline two\n\n```txt\ncode line one\ncode line two\n```\n';
    const { output } = compact(input, { unwrapLines: true, versionMarker: false } as never);
    const restored = expand(output);

    expect(restored).toContain('# Header');
    expect(restored).toContain('line one line two');
    expect(restored).toContain('code line one\ncode line two');
  });

  test('produces valid markdown round-trip output even when lossy', () => {
    const input = '# Title\n\nalpha\nbeta\ngamma\n';
    const { output } = compact(input, { unwrapLines: true, versionMarker: false } as never);
    const restored = expand(output);

    expect(restored).toContain('alpha beta gamma');
    expect(restored.trim()).not.toBe(input.trim());
  });
});
