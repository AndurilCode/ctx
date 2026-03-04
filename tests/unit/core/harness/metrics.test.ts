import { describe, expect, test } from 'bun:test';
import { computeMetrics } from '../../../../src/core/harness/metrics.js';
import { createHarnessState, recordToolCall } from '../../../../src/core/harness/state.js';

describe('computeMetrics', () => {
  test('computes tokens per mutation', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 1000, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'b.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'edit', args: { file: 'a.ts' }, tokensConsumed: 200, durationMs: 100 });
    const m = computeMetrics(state);
    expect(m.totalTokensConsumed).toBe(1700);
    expect(m.tokensPerMutation).toBe(1700);
    expect(m.readsPerMutation).toBe(2);
  });

  test('computes cache hit rate', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('a.ts', { strategy: 'full', tokens: 500, turn: 1 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 0, durationMs: 1 });
    recordToolCall(state, { tool: 'read', args: { file: 'b.ts' }, tokensConsumed: 300, durationMs: 50 });
    const m = computeMetrics(state);
    expect(m.cacheHitRate).toBeCloseTo(0.5, 1);
  });

  test('handles zero mutations gracefully', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 1000, durationMs: 50 });
    const m = computeMetrics(state);
    expect(m.tokensPerMutation).toBe(Infinity);
    expect(m.readsPerMutation).toBe(Infinity);
  });

  test('counts wasted reads correctly', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'b.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'c.ts' }, tokensConsumed: 500, durationMs: 50 });
    recordToolCall(state, { tool: 'edit', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 100 });
    const m = computeMetrics(state);
    expect(m.wastedReads).toBe(2); // b.ts and c.ts never mutated
  });

  test('reports depthEscalations from signals', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.signals.depthEscalations = 3;
    const m = computeMetrics(state);
    expect(m.depthEscalations).toBe(3);
  });

  test('returns zero cache hit rate with no reads', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const m = computeMetrics(state);
    expect(m.cacheHitRate).toBe(0);
  });
});
