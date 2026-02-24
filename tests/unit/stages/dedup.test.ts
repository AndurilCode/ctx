import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';
import { verify } from '../../../src/core/verify.js';

describe('dedup stage', () => {
  test('adds dictionary entries and placeholder references for repeated terms', () => {
    const input = '# Title\n\nAGENTS.md AGENTS.md AGENTS.md AGENTS.md';
    const { output } = compact(input, { dedup: true, versionMarker: false });

    expect(output).toContain('§§');
    expect(output).toMatch(/§\d+=AGENTS\.md/);
    expect(output).toContain(':1 Title');
    expect(output).toMatch(/§\d+ §\d+ §\d+ §\d+/);
  });

  test('round-trips losslessly when dedup is enabled', () => {
    const input = '# Title\n\nAGENTS.md AGENTS.md AGENTS.md AGENTS.md';
    expect(verify(input, { dedup: true })).toBe(true);
  });
});
