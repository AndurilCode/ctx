import { describe, expect, test } from 'bun:test';
import { evaluateRules } from '../../../../src/core/harness/rules.js';
import { createHarnessState, recordToolCall } from '../../../../src/core/harness/state.js';

describe('evaluateRules', () => {
  test('allows small file reads without interception', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const fileTokens = new Map([['small.ts', 100]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'small.ts' } }, state, fileTokens);
    expect(result.outcome).toBe('allow');
  });

  test('escalates large file reads without maxTokens', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const fileTokens = new Map([['big.ts', 5000]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'big.ts' } }, state, fileTokens);
    expect(result.outcome).toBe('escalate');
  });

  test('allows large file reads when maxTokens is set', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const fileTokens = new Map([['big.ts', 5000]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'big.ts', maxTokens: 800 } }, state, fileTokens);
    expect(result.outcome).toBe('allow');
  });

  test('rewrites unscoped grep to rank', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = evaluateRules({ tool: 'grep', args: { pattern: 'TODO' } }, state, new Map());
    expect(result.outcome).toBe('rewrite');
    if (result.outcome === 'rewrite') {
      expect(result.tool).toBe('rank');
    }
  });

  test('allows scoped grep', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = evaluateRules({ tool: 'grep', args: { pattern: 'TODO', path: 'src/' } }, state, new Map());
    expect(result.outcome).toBe('allow');
  });

  test('injects read before mutation on unread file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = evaluateRules({ tool: 'edit', args: { file: 'unread.ts' } }, state, new Map());
    expect(result.outcome).toBe('rewrite');
  });

  test('allows mutation on already-read file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'known.ts' }, tokensConsumed: 200, durationMs: 20 });
    const result = evaluateRules({ tool: 'edit', args: { file: 'known.ts' } }, state, new Map());
    expect(result.outcome).toBe('allow');
  });

  test('escalates when budget is exhausted', () => {
    const state = createHarnessState({ contextWindow: 10_000 });
    state.budget.consumed.working = 3800;
    const fileTokens = new Map([['file.ts', 500]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'file.ts' } }, state, fileTokens);
    expect(result.outcome).toBe('escalate');
  });
});
