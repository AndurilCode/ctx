import { describe, expect, test } from 'bun:test';
import {
  createHarnessState, buildProfile, decide, computeMetrics,
  recordToolCall, updateSignals, serialize, deserialize,
} from '../../../../src/core/harness/index.js';

describe('harness integration', () => {
  test('full session lifecycle: classify → decide → record → measure', async () => {
    // 1. Classify task
    const profile = buildProfile('fix the auth bug in src/auth.ts', {
      sequentialReads: 0, budgetConsumedPct: 0, depthEscalations: 0,
      uniqueFilesRead: 0, mutations: 0, sameFileRereads: 0, toolDiversity: 0,
    });
    expect(profile.type).toBe('targeted_fix');
    expect(profile.focalFiles).toContain('src/auth.ts');

    // 2. Create state with classified profile
    const state = createHarnessState({ contextWindow: 200_000, profile });

    // 3. Agent wants to read a big file — should suggest cheaper alternative
    const decision = await decide(
      { tool: 'read', args: { file: 'src/auth.ts' } },
      state,
      { fileTokens: new Map([['src/auth.ts', 4000]]), mentionedSymbols: [] },
    );
    expect(decision.action).toBe('rewrite');

    // 4. Record what actually happened (agent took the suggestion)
    recordToolCall(state, { tool: 'outline', args: { file: 'src/auth.ts' }, tokensConsumed: 200, durationMs: 50 });
    recordToolCall(state, { tool: 'read', args: { file: 'src/auth.ts', maxTokens: 800 }, tokensConsumed: 800, durationMs: 80 });
    recordToolCall(state, { tool: 'edit', args: { file: 'src/auth.ts' }, tokensConsumed: 100, durationMs: 150 });

    // 5. Compute metrics
    updateSignals(state);
    const metrics = computeMetrics(state);
    expect(metrics.totalTokensConsumed).toBe(1100);
    expect(metrics.tokensPerMutation).toBe(1100);
    expect(metrics.readsPerMutation).toBe(2);

    // 6. Serialize/deserialize survives
    const restored = deserialize(serialize(state));
    expect(restored.turn).toBe(3);
    expect(restored.cache.filesRead.has('src/auth.ts')).toBe(true);
  });
});
