import { describe, expect, test } from 'bun:test';
import { tokenCount } from '../../../src/core/token-count.js';

describe('tokenCount', () => {
  test('counts tokens, bytes, and lines for inline text', async () => {
    const result = await tokenCount({ text: 'hello world\nfoo bar' });
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.bytes).toBe(19);
    expect(result.lines).toBe(2);
  });

  test('counts from a file path', async () => {
    const result = await tokenCount({ file: 'package.json' });
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.lines).toBeGreaterThan(0);
  });

  test('throws if neither text nor file provided', async () => {
    await expect(tokenCount({})).rejects.toThrow();
  });
});
