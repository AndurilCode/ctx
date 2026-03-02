import { describe, expect, test } from 'bun:test';
import { focus } from '../../../src/core/focus.js';

describe('focus', () => {
  test('returns rich symbol context for a known symbol', async () => {
    const result = await focus({
      file: 'src/core/verify.ts',
      symbol: 'verify',
      include: ['body', 'callers', 'deps', 'types', 'conventions'],
      maxTokens: 800,
    });

    expect(result.output).toContain('focus: verify');
    expect(result.output).toContain('── body');
    expect(result.output).toContain('── conventions');
  });

  test('falls back to outline when symbol is missing', async () => {
    const result = await focus({
      file: 'src/core/verify.ts',
      symbol: 'definitelyMissingSymbol',
    });
    expect(result.output).toContain('symbol not found');
  });
});
