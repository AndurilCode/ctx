import { describe, expect, test } from 'bun:test';
import { createHarnessState, recordToolCall } from '../../../../src/core/harness/state.js';
import { computeMetrics } from '../../../../src/core/harness/metrics.js';
import { serialize, deserialize } from '../../../../src/core/harness/serialize.js';

describe('rewrite compliance tracking', () => {
  test('tracks followed rewrite suggestions', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.pendingRewrite = { turn: 0, suggestedTool: 'outline', suggestedArgs: { file: 'big.ts' } };

    recordToolCall(state, { tool: 'outline', args: { file: 'big.ts' }, tokensConsumed: 50, durationMs: 5 });
    expect(state.rewriteCompliance.followed).toBe(1);
    expect(state.rewriteCompliance.ignored).toBe(0);
    expect(state.pendingRewrite).toBeUndefined();
  });

  test('tracks ignored rewrite suggestions', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.pendingRewrite = { turn: 0, suggestedTool: 'outline', suggestedArgs: { file: 'big.ts' } };

    recordToolCall(state, { tool: 'read', args: { file: 'big.ts' }, tokensConsumed: 5000, durationMs: 10 });
    expect(state.rewriteCompliance.followed).toBe(0);
    expect(state.rewriteCompliance.ignored).toBe(1);
    expect(state.pendingRewrite).toBeUndefined();
  });

  test('no pending rewrite does not affect compliance', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 });
    expect(state.rewriteCompliance.followed).toBe(0);
    expect(state.rewriteCompliance.ignored).toBe(0);
  });
});

describe('metrics with rewrite acceptance', () => {
  test('computeMetrics includes rewriteAcceptanceRate', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.rewriteCompliance = { followed: 3, ignored: 1 };
    // Need at least one history entry for metrics
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 });
    const metrics = computeMetrics(state);
    expect(metrics.rewriteAcceptanceRate).toBe(0.75);
  });

  test('rewriteAcceptanceRate is 1 when no rewrites suggested', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 });
    const metrics = computeMetrics(state);
    expect(metrics.rewriteAcceptanceRate).toBe(1);
  });
});

describe('feedback state serialization', () => {
  test('pendingRewrite and rewriteCompliance survive roundtrip', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.pendingRewrite = { turn: 5, suggestedTool: 'outline', suggestedArgs: { file: 'big.ts' } };
    state.rewriteCompliance = { followed: 2, ignored: 1 };

    const serialized = serialize(state);
    const restored = deserialize(serialized);

    expect(restored.pendingRewrite).toEqual({ turn: 5, suggestedTool: 'outline', suggestedArgs: { file: 'big.ts' } });
    expect(restored.rewriteCompliance).toEqual({ followed: 2, ignored: 1 });
  });

  test('deserialize handles missing feedback fields (backward compat)', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const serialized = serialize(state);
    // Remove the new fields to simulate old state format
    delete (serialized as any).pendingRewrite;
    delete (serialized as any).rewriteCompliance;

    const restored = deserialize(serialized);
    expect(restored.pendingRewrite).toBeUndefined();
    expect(restored.rewriteCompliance).toEqual({ followed: 0, ignored: 0 });
  });
});
