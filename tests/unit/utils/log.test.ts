import { describe, expect, test } from 'bun:test';
import { pruneTerminalLog } from '../../../src/utils/log.js';

describe('pruneTerminalLog', () => {
  test('strips ansi escape sequences', () => {
    const input = '\u001b[32mPASS\u001b[0m test suite';
    const result = pruneTerminalLog(input);

    expect(result.output).toBe('PASS test suite');
    expect(result.appliedRules).toContain('ansi-strip');
  });

  test('elides passing tests when failures exist', () => {
    const input = ['✓ test one', '✓ test two', '✗ test three', 'Tests: 2 passed, 1 failed'].join(
      '\n',
    );
    const result = pruneTerminalLog(input, { allowTokenExpansion: true });

    expect(result.output).toContain('[tests pruned: 2 passing stripped, 1 failing kept]');
    expect(result.output).toContain('✗ test three');
    expect(result.output).not.toContain('✓ test one');
  });

  test('elides passing tests on pass-only runs when enough pass lines exist', () => {
    const input = [
      '(pass) one',
      '(pass) two',
      '(pass) three',
      '(pass) four',
      '(pass) five',
      'Test Suites: 5 passed, 5 total',
    ].join('\n');
    const result = pruneTerminalLog(input);

    expect(result.output).toContain('[tests pruned: 5 passing stripped, 0 failing kept]');
    expect(result.output).toContain('Test Suites: 5 passed, 5 total');
    expect(result.output).not.toContain('(pass) one');
  });

  test('strips timestamps in auto mode when most lines match', () => {
    const input = [
      '2026-02-25T10:00:00Z GET /health 200',
      '2026-02-25T10:00:01Z GET /users 200',
      '2026-02-25T10:00:02Z GET /users 500',
    ].join('\n');

    const result = pruneTerminalLog(input, {
      stripTimestamps: 'auto',
      foldRepeatedLines: false,
      foldGlobalRepeats: false,
      elideHealthChecks: false,
    });
    expect(result.output).toContain('[timestamps stripped: iso]');
    expect(result.output).toContain('GET /users 500');
    expect(result.output).not.toContain('2026-02-25T10:00:02Z');
  });

  test('applies custom strip/fold/block rules', () => {
    const input = [
      'DEBUG init',
      'DEBUG cache',
      'warn one',
      'warn two',
      'BEGIN',
      'payload',
      'END',
      'kept',
    ].join('\n');

    const result = pruneTerminalLog(input, {
      customRules: [
        { type: 'strip', pattern: '^DEBUG' },
        { type: 'fold', pattern: '^warn', label: 'warnings' },
        { type: 'block', start: '^BEGIN$', end: '^END$', label: 'request' },
      ],
    });

    expect(result.output).toContain('[warnings: 2 lines]');
    expect(result.output).toContain('[request: 3 lines folded]');
    expect(result.output).toContain('kept');
    expect(result.output).not.toContain('DEBUG init');
  });

  test('folds JSON-line logs and stack trace repeats', () => {
    const input = [
      '{"level":"info","msg":"ok"}',
      '{"level":"error","msg":"boom"}',
      '{"level":"warn","msg":"warn"}',
      '{"level":"debug","msg":"dbg"}',
      '{"level":"info","msg":"ok2"}',
      '{"level":"info","msg":"ok3"}',
      '{"level":"info","msg":"ok4"}',
      '{"level":"info","msg":"ok5"}',
      'Error: Database down',
      '  at connect (db.ts:10:2)',
      '',
      'Error: Database down',
      '  at connect (db.ts:10:2)',
      '',
    ].join('\n');
    const result = pruneTerminalLog(input, { allowTokenExpansion: true });

    expect(result.output).toContain('[json lines folded: 7');
    expect(result.appliedRules).toContain('json-line-fold');
    expect(result.output).toContain('[stack repeated 1x]');
  });

  test('falls back to original output when pruning does not save tokens', () => {
    const input = [
      'src/a.ts(12,5): error TS2322: Type string is not assignable to number.',
      'src/a.ts(13,9): error TS2339: Property foo does not exist on type Bar.',
      'src/b.ts(1,1): error TS2307: Cannot find module x.',
      'src/b.ts(9,3): error TS7006: Parameter y implicitly has an any type.',
    ].join('\n');

    const result = pruneTerminalLog(input, { allowTokenExpansion: false });
    expect(result.output).toBe(input);
    expect(result.savingsPercent).toBe(0);
    expect(result.appliedRules).toEqual([]);
  });

  test('can keep expanded output when explicitly allowed', () => {
    const input = [
      'src/a.ts(12,5): error TS2322: Type string is not assignable to number.',
      'src/a.ts(13,9): error TS2339: Property foo does not exist on type Bar.',
      'src/b.ts(1,1): error TS2307: Cannot find module x.',
      'src/b.ts(9,3): error TS7006: Parameter y implicitly has an any type.',
    ].join('\n');

    const result = pruneTerminalLog(input, { allowTokenExpansion: true });
    expect(result.appliedRules).toContain('typecheck-fold');
  });
});
