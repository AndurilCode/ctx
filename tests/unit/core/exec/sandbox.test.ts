import { describe, expect, test } from 'bun:test';
import { executeCode } from '../../../../src/core/exec/index.js';

describe('executeCode', () => {
  test('executes simple code and returns result', async () => {
    const result = await executeCode({ code: 'return 1 + 2' });
    expect(result.success).toBe(true);
    expect(result.result).toBe(3);
  });

  test('captures log output', async () => {
    const result = await executeCode({ code: 'log("hello"); log("world")' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello\nworld');
  });

  test('captures json output', async () => {
    const result = await executeCode({ code: 'json({ a: 1 })' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('"a": 1');
  });

  test('log pretty-prints objects', async () => {
    const result = await executeCode({ code: 'log({ x: 42 })' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('"x": 42');
  });

  test('timeout triggers after configured ms', async () => {
    const result = await executeCode({
      code: 'await new Promise(r => setTimeout(r, 5000))',
      timeout: 100,
    });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('timed out');
  });

  test('code cannot access process', async () => {
    const result = await executeCode({ code: 'return typeof process' });
    expect(result.success).toBe(true);
    expect(result.result).toBe('undefined');
  });

  test('code cannot access require', async () => {
    const result = await executeCode({ code: 'return typeof require' });
    expect(result.success).toBe(true);
    expect(result.result).toBe('undefined');
  });

  test('code cannot access Bun', async () => {
    const result = await executeCode({ code: 'return typeof Bun' });
    expect(result.success).toBe(true);
    expect(result.result).toBe('undefined');
  });

  test('patch() throws without allowWrite', async () => {
    const result = await executeCode({ code: 'patch({})' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('--allow-write');
  });

  test('insert() throws without allowWrite', async () => {
    const result = await executeCode({ code: 'insert({})' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('--allow-write');
  });

  test('rename() throws without allowWrite', async () => {
    const result = await executeCode({ code: 'rename({})' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('--allow-write');
  });

  test('code size limit enforced', async () => {
    const bigCode = 'x'.repeat(17 * 1024);
    const result = await executeCode({ code: bigCode });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('CodeSizeError');
  });

  test('syntax errors return structured error', async () => {
    const result = await executeCode({ code: 'const x = {' });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('SyntaxError');
  });

  test('async/await works with tree()', async () => {
    const result = await executeCode({
      code: 'const t = await tree({ depth: 0 }); log(t.totalFiles)',
      cwd: process.cwd(),
    });
    expect(result.success).toBe(true);
    expect(Number(result.output.trim())).toBeGreaterThan(0);
  });

  test('runtime errors return structured error', async () => {
    const result = await executeCode({ code: 'throw new TypeError("bad value")' });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TypeError');
    expect(result.error?.message).toBe('bad value');
  });

  test('durationMs is reported', async () => {
    const result = await executeCode({ code: 'return 1' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('tokensUsed is reported', async () => {
    const result = await executeCode({ code: 'log("some output text here")' });
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  test('output truncation at token limit', async () => {
    // Generate a large output that exceeds a very small token budget
    const result = await executeCode({
      code: 'for (let i = 0; i < 1000; i++) log("line " + i + " with some padding text to use tokens")',
      maxOutputTokens: 50,
    });
    expect(result.truncated).toBe(true);
    expect(result.output).toContain('[output truncated]');
  });
});
