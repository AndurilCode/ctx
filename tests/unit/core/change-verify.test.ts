import { describe, expect, test } from 'bun:test';
import { verifyChanges } from '../../../src/core/change-verify.js';

describe('verifyChanges', () => {
  test('builds a plan for a target file and symbol', async () => {
    const result = await verifyChanges({
      file: 'src/core/verify.ts',
      symbol: 'verify',
      since: '0000',
    });
    expect(result.mode).toBe('plan');
    expect(result.plan.length).toBeGreaterThan(0);
    expect(result.output).toContain('── verify plan');
  });

  test('exec mode runs provided commands', async () => {
    const result = await verifyChanges({
      file: 'src/core/verify.ts',
      exec: true,
      typeCommand: 'echo typecheck-pass',
      testCommand: 'echo tests-pass',
      timeoutMs: 10_000,
    });
    expect(result.mode).toBe('exec');
    expect(result.typeCheck?.passed).toBe(true);
    expect(result.tests?.passed).toBe(true);
  });
});
