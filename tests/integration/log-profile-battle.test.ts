import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pruneLog } from '../../src/core/prune-log.js';
import { resolveProfiledOptions } from '../../src/utils/log-profiles.js';

function fixture(name: string): string {
  return readFileSync(resolve('tests/fixtures/logs', name), 'utf8');
}

describe('log profile battle tests', () => {
  test('test profile preserves failures and compresses pass noise', () => {
    const input = fixture('test.log');
    const result = pruneLog(input, resolveProfiledOptions('test', {}));

    expect(result.savingsPercent).toBeGreaterThan(20);
    expect(result.output).toContain('(fail) b four [5ms]');
    expect(result.output).toContain('Tests:       1 failed, 8 passed, 9 total');
    expect(result.output).toContain('[tests pruned:');
  });

  test('ci profile collapses setup boilerplate', () => {
    const input = fixture('ci.log');
    const result = pruneLog(input, resolveProfiledOptions('ci', {}));

    expect(result.savingsPercent).toBeGreaterThan(20);
    expect(result.output).toContain('[ci-setup:');
    expect(result.output).toContain('added 847 packages in 12s');
    expect(result.output).not.toContain('npm warn deprecated foo@1.0.0');
  });

  test('lint profile keeps diagnostics and strips code-frame noise', () => {
    const input = fixture('lint.log');
    const result = pruneLog(input, resolveProfiledOptions('lint', {}));

    expect(result.savingsPercent).toBeGreaterThan(35);
    expect(result.output).toContain('Forbidden non-null assertion');
    expect(result.output).toContain('[diagnostic');
    expect(result.output).not.toContain('10 10 │ a');
  });

  test('runtime profile strips timestamps and folds repeated runtime structure', () => {
    const input = fixture('runtime.log');
    const result = pruneLog(input, resolveProfiledOptions('runtime', {}));

    expect(result.savingsPercent).toBeGreaterThan(30);
    expect(result.output).toContain('[timestamps stripped: iso]');
    expect(result.output).toContain('[json lines folded:');
    expect(result.output).toContain('[stack repeated 1x]');
    expect(result.output).toContain('Error: database timeout');
    expect(result.output).not.toContain('2026-02-25T10:00:00Z');
  });
});
