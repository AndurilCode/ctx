import { describe, expect, test } from 'bun:test';
import { createHarnessState, serialize, deserialize, recordToolCall, updateSignals } from '../../../../src/core/harness/state.js';

describe('createHarnessState', () => {
  test('creates default state with given context window size', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    expect(state.budget.total).toBe(200_000);
    expect(state.budget.allocated.system).toBeCloseTo(30_000, -3);
    expect(state.budget.allocated.starter).toBeCloseTo(50_000, -3);
    expect(state.budget.allocated.working).toBeCloseTo(80_000, -3);
    expect(state.budget.allocated.output).toBeCloseTo(30_000, -3);
    expect(state.budget.allocated.safety).toBeCloseTo(10_000, -3);
    expect(state.turn).toBe(0);
    expect(state.history).toEqual([]);
  });
});

describe('serialize / deserialize', () => {
  test('round-trips state through JSON', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('foo.ts', { strategy: 'full', tokens: 500, turn: 1 });
    state.cache.symbolsSeen.add('MyClass');
    state.cache.hotFiles.add('bar.ts');

    const json = serialize(state);
    const restored = deserialize(json);

    expect(restored.cache.filesRead.get('foo.ts')?.tokens).toBe(500);
    expect(restored.cache.symbolsSeen.has('MyClass')).toBe(true);
    expect(restored.cache.hotFiles.has('bar.ts')).toBe(true);
    expect(restored.budget.total).toBe(200_000);
  });
});

describe('recordToolCall', () => {
  test('appends to history and increments turn', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'x.ts' }, tokensConsumed: 500, durationMs: 50 });
    expect(state.history.length).toBe(1);
    expect(state.turn).toBe(1);
    expect(state.history[0].tool).toBe('read');
  });

  test('updates cache for read tools', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 500, durationMs: 50 });
    expect(state.cache.filesRead.has('a.ts')).toBe(true);
  });

  test('tracks hot files for mutations', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'edit', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 50 });
    expect(state.cache.hotFiles.has('a.ts')).toBe(true);
  });

  test('tracks same-file rereads', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 500, durationMs: 50 });
    expect(state.signals.sameFileRereads).toBe(1);
  });
});

describe('updateSignals', () => {
  test('computes signals from history', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'b.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'c.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'd.ts' }, tokensConsumed: 500, durationMs: 50 });

    updateSignals(state);
    expect(state.signals.sequentialReads).toBe(4);
    expect(state.signals.uniqueFilesRead).toBe(4);
    expect(state.signals.mutations).toBe(0);
    expect(state.signals.budgetConsumedPct).toBeCloseTo(2000 / 80_000, 2);
  });
});
