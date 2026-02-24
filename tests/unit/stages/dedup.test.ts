import { describe, expect, test } from 'bun:test';
import { compact } from '../../../src/core/compact.js';
import { verify } from '../../../src/core/verify.js';

describe('dedup stage', () => {
  test('deduplicates repeated multi-word phrases that save tokens', () => {
    const phrase = 'the repeated phrase here';
    const input = `# Title\n\n${phrase} end. ${phrase} end. ${phrase} end. ${phrase} end.`;
    const { output } = compact(input, { dedup: true, versionMarker: false });

    expect(output).toContain('§§');
    expect(output).toMatch(/§\d+/);
    expect(output).toContain(':1 Title');
  });

  test('skips single words that cost fewer tokens than the marker', () => {
    const input = '# Title\n\nfoo foo foo foo bar bar bar bar';
    const { output } = compact(input, { dedup: true, versionMarker: false });

    expect(output).not.toContain('§§');
    expect(output).not.toMatch(/§\d+/);
  });

  test('round-trips losslessly when dedup is enabled', () => {
    const phrase = 'the repeated phrase here';
    const input = `# Title\n\n${phrase} end. ${phrase} end. ${phrase} end. ${phrase} end.`;
    expect(verify(input, { dedup: true })).toBe(true);
  });
});
