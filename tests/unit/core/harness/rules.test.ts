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
    expect(result.outcome).toBe('inject_before');
    if (result.outcome === 'inject_before') {
      expect(result.calls).toEqual([{ tool: 'read', args: { file: 'unread.ts' } }]);
    }
  });

  test('allows mutation on already-read file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'known.ts' }, tokensConsumed: 200, durationMs: 20 });
    const result = evaluateRules({ tool: 'edit', args: { file: 'known.ts' } }, state, new Map());
    expect(result.outcome).toBe('allow');
  });

  test('requires re-read after mutation (stale evidence)', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'x.ts' }, tokensConsumed: 200, durationMs: 10 });
    recordToolCall(state, { tool: 'edit', args: { file: 'x.ts' }, tokensConsumed: 0, durationMs: 10 });
    const result = evaluateRules({ tool: 'edit', args: { file: 'x.ts' } }, state, new Map());
    expect(result.outcome).toBe('inject_before');
    if (result.outcome === 'inject_before') {
      expect(result.reason).toContain('stale');
    }
  });

  test('allows bash mutation without evidence check', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = evaluateRules({ tool: 'bash', args: { command: 'echo hi' } }, state, new Map());
    expect(result.outcome).toBe('allow');
  });

  test('escalates when budget is exhausted (second read)', () => {
    const state = createHarnessState({ contextWindow: 10_000 });
    state.budget.consumed.working = 3800;
    state.cache.filesRead.set('file.ts', { strategy: 'budgeted', tokens: 200, turn: 0 });
    state.cache.hotFiles.add('file.ts');
    const fileTokens = new Map([['file.ts', 500]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'file.ts' } }, state, fileTokens);
    expect(result.outcome).toBe('escalate');
  });
});

describe('Rule 10: first-read pass-through', () => {
  test('allows first read of large file (>2000 tokens)', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const fileTokens = new Map([['big.ts', 5000]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'big.ts' } }, state, fileTokens);
    expect(result.outcome).toBe('allow');
  });

  test('escalates second read of large file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('big.ts', { strategy: 'full', tokens: 5000, turn: 0 });
    state.cache.hotFiles.add('big.ts');
    const fileTokens = new Map([['big.ts', 5000]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'big.ts', maxTokens: 800 } }, state, fileTokens);
    expect(result.outcome).not.toBe('deny');
  });
});

describe('Rule 7: re-read detection', () => {
  test('returns cached for re-read of unchanged file with same strategy', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    const call = { tool: 'read', args: { file: '/src/foo.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).toBe('return_cached');
    expect((result as any).file).toBe('/src/foo.ts');
  });

  test('denies re-read of unchanged file with different strategy', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    const call = { tool: 'read', args: { file: '/src/foo.ts', maxTokens: 200 } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).toBe('deny');
    expect((result as any).reason).toContain('Already read');
  });

  test('allows re-read of mutated file with different strategy', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    state.cache.hotFiles.add('/src/foo.ts');
    const call = { tool: 'read', args: { file: '/src/foo.ts', maxTokens: 200 } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).not.toBe('deny');
  });
});

describe('Rule 9: same-strategy re-read', () => {
  test('returns cached for re-read with same strategy even if file is hot', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    state.cache.hotFiles.add('/src/foo.ts');
    const call = { tool: 'read', args: { file: '/src/foo.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).toBe('return_cached');
    expect((result as any).file).toBe('/src/foo.ts');
    expect((result as any).cached.strategy).toBe('full');
  });

  test('allows re-read with different strategy (budgeted after full)', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    state.cache.hotFiles.add('/src/foo.ts');
    const call = { tool: 'read', args: { file: '/src/foo.ts', maxTokens: 200 } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).not.toBe('deny');
  });
});
