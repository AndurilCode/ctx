import { describe, expect, test } from 'bun:test';
import { createHarnessState, serialize, deserialize } from '../../../../src/core/harness/index.js';
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
});
