import { describe, expect, test } from 'bun:test';
import { createHarnessState, serialize, deserialize, recordToolCall, evaluateRules } from '../../../../src/core/harness/index.js';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('hook integration pattern', () => {
  const statePath = join(tmpdir(), 'test-harness-state.json');

  test('state persists across simulated hook invocations', () => {
    // Simulate first hook invocation
    const state = createHarnessState({ contextWindow: 200_000 });
    writeFileSync(statePath, JSON.stringify(serialize(state), null, 2));

    // Simulate second hook invocation
    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    const restored = deserialize(raw);
    expect(restored.turn).toBe(0);
    expect(restored.budget.total).toBe(200_000);

    if (existsSync(statePath)) unlinkSync(statePath);
  });

  test('recordToolCall normalizes file_path arg', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, {
      tool: 'read',
      args: { file_path: '/src/foo.ts' },
      tokensConsumed: 500,
      durationMs: 10,
    });
    expect(state.cache.filesRead.has('/src/foo.ts')).toBe(true);
  });

  test('state accumulates across invocations', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    // Simulate recording a tool call
    state.turn = 5;
    state.budget.consumed.working = 3000;
    state.cache.filesRead.set('auth.ts', { strategy: 'outline', tokens: 200, turn: 3 });

    writeFileSync(statePath, JSON.stringify(serialize(state), null, 2));

    const raw = JSON.parse(readFileSync(statePath, 'utf8'));
    const restored = deserialize(raw);
    expect(restored.turn).toBe(5);
    expect(restored.budget.consumed.working).toBe(3000);
    expect(restored.cache.filesRead.get('auth.ts')?.strategy).toBe('outline');

    if (existsSync(statePath)) unlinkSync(statePath);
  });

  test('state should not record calls that are denied or rewritten', () => {
    const state = createHarnessState({ contextWindow: 200_000 });

    // Simulate: first read is allowed, record it
    recordToolCall(state, { tool: 'read', args: { file: 'big.ts' }, tokensConsumed: 5000, durationMs: 10 });
    expect(state.cache.filesRead.has('big.ts')).toBe(true);
    expect(state.cache.filesRead.size).toBe(1);

    // If a second read of the same file would be denied (Rule 9),
    // the hook should NOT call recordToolCall. Verify that if we
    // DON'T call recordToolCall, state stays clean:
    // (This test documents the expected behavior of the hook)
    const rulesResult = evaluateRules(
      { tool: 'read', args: { file: 'big.ts' } },
      state,
      new Map([['big.ts', 5000]]),
    );
    expect(rulesResult.outcome).toBe('escalate');
    // State should still have exactly 1 entry, not 2
    expect(state.cache.filesRead.size).toBe(1);
    expect(state.signals.sameFileRereads).toBe(0);
  });
});
