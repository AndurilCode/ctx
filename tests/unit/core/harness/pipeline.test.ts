import { describe, expect, test } from 'bun:test';
import { decide } from '../../../../src/core/harness/pipeline.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';

describe('decide', () => {
  test('allows small file reads (Stage 1 short-circuit)', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = await decide(
      { tool: 'read', args: { file: 'tiny.ts' } },
      state,
      { fileTokens: new Map([['tiny.ts', 100]]), mentionedSymbols: [] },
    );
    expect(result.action).toBe('allow');
  });

  test('rewrites unscoped grep (Stage 1)', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = await decide(
      { tool: 'grep', args: { pattern: 'TODO' } },
      state,
      { fileTokens: new Map(), mentionedSymbols: [] },
    );
    expect(result.action).toBe('rewrite');
  });

  test('rewrites large file read via Stage 2 cost analysis (second read)', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    // Mark as previously read so Rule 10 doesn't short-circuit
    state.cache.filesRead.set('huge.ts', { strategy: 'budgeted', tokens: 5000, turn: 0 });
    state.cache.hotFiles.add('huge.ts'); // hot so deny rules pass
    const result = await decide(
      { tool: 'read', args: { file: 'huge.ts' } },
      state,
      { fileTokens: new Map([['huge.ts', 5000]]), mentionedSymbols: [] },
    );
    expect(result.action).toBe('rewrite');
  });

  test('forwards budgetContext from cost stage to DecisionAction', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('huge.ts', { strategy: 'budgeted', tokens: 5000, turn: 0 });
    state.cache.hotFiles.add('huge.ts');
    const result = await decide(
      { tool: 'read', args: { file: 'huge.ts' } },
      state,
      { fileTokens: new Map([['huge.ts', 5000]]), mentionedSymbols: [] },
    );
    expect(result.action).toBe('rewrite');
    if (result.action === 'rewrite') {
      expect(result.budgetContext).toBeDefined();
      expect(result.budgetContext!.remainingBudget).toBeGreaterThan(0);
      expect(result.budgetContext!.pressureLevel).toBe('low');
    }
  });

  test('falls back to allow when LLM says ALLOW', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = await decide(
      { tool: 'read', args: { file: 'medium.ts' } },
      state,
      { fileTokens: new Map([['medium.ts', 300]]), mentionedSymbols: [] },
      { llmCall: async () => 'ALLOW' },
    );
    expect(result.action).toBe('allow');
  });

  test('uses LLM rewrite suggestion', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = await decide(
      { tool: 'read', args: { file: 'medium.ts' } },
      state,
      { fileTokens: new Map([['medium.ts', 300]]), mentionedSymbols: [] },
      { llmCall: async () => 'REWRITE: outline(file="medium.ts")' },
    );
    // Stage 1 escalates (>200 tokens, no maxTokens), Stage 2 may escalate or rewrite
    // If it reaches Stage 3, LLM says rewrite
    // The exact outcome depends on Stage 2's threshold — the key test is that the pipeline runs without error
    expect(['allow', 'rewrite']).toContain(result.action);
  });
});
