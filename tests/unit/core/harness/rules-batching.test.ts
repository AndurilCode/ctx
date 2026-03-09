import { describe, expect, test } from 'bun:test';
import { evaluateRules } from '../../../../src/core/harness/rules.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';

describe('Rule 8: sequence batching', () => {
  test('escalates when 3+ reads in same directory in recent history', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toBe('dir_batching');
  });

  test('allows when only 2 reads in same directory', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).not.toBe('deny');
  });

  test('only checks last 5 history entries', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/other/x.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 3, tool: 'read', args: { file: '/other/y.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 4, tool: 'read', args: { file: '/other/z.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).not.toBe('deny');
  });

  test('does not fire for grep', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'grep', args: { pattern: 'foo', path: '/src/core/' } };
    const result = evaluateRules(call, state, new Map());
    expect(result.outcome).not.toBe('deny');
  });

  test('detects batching even with interleaved non-read calls', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'grep', args: { pattern: 'foo' }, tokensConsumed: 50, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 3, tool: 'bash', args: { command: 'ls' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 4, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toBe('dir_batching');
  });

  test('only considers last 5 reads, not last 5 calls', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 3, tool: 'bash', args: { command: 'ls' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 4, tool: 'bash', args: { command: 'pwd' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 5, tool: 'bash', args: { command: 'echo' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 6, tool: 'bash', args: { command: 'date' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 7, tool: 'bash', args: { command: 'whoami' }, tokensConsumed: 20, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toBe('dir_batching');
  });
});
