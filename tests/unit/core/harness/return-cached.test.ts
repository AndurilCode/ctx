import { describe, expect, test } from 'bun:test';
import { evaluateRules } from '../../../../src/core/harness/rules.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';
import { decide } from '../../../../src/core/harness/pipeline.js';

describe('Phase 2: return_cached in rules', () => {
  test('same-strategy re-read produces return_cached with file and cached info', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/a.ts', { strategy: 'full', tokens: 300, turn: 1 });
    const result = evaluateRules(
      { tool: 'read', args: { file: '/src/a.ts' } },
      state,
      new Map([['/src/a.ts', 300]]),
    );
    expect(result.outcome).toBe('return_cached');
    if (result.outcome === 'return_cached') {
      expect(result.file).toBe('/src/a.ts');
      expect(result.cached.strategy).toBe('full');
      expect(result.cached.tokens).toBe(300);
      expect(result.cached.turn).toBe(1);
    }
  });

  test('budgeted re-read of budgeted file produces return_cached', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/b.ts', { strategy: 'budgeted', tokens: 100, turn: 2 });
    const result = evaluateRules(
      { tool: 'read', args: { file: '/src/b.ts', maxTokens: 500 } },
      state,
      new Map([['/src/b.ts', 1000]]),
    );
    expect(result.outcome).toBe('return_cached');
  });

  test('different-strategy re-read of non-hot file still denies', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/c.ts', { strategy: 'full', tokens: 500, turn: 0 });
    const result = evaluateRules(
      { tool: 'read', args: { file: '/src/c.ts', maxTokens: 200 } },
      state,
      new Map([['/src/c.ts', 500]]),
    );
    expect(result.outcome).toBe('deny');
  });
});

describe('Phase 2: return_cached in pipeline', () => {
  test('pipeline produces return_cached decision for same-strategy re-read', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/x.ts', { strategy: 'full', tokens: 400, turn: 0 });
    const decision = await decide(
      { tool: 'read', args: { file: '/src/x.ts' } },
      state,
      { fileTokens: new Map([['/src/x.ts', 400]]), mentionedSymbols: [] },
    );
    expect(decision.action).toBe('return_cached');
    if (decision.action === 'return_cached') {
      const result = decision.result as { file: string; strategy: string };
      expect(result.file).toBe('/src/x.ts');
      expect(result.strategy).toBe('full');
    }
  });
});
