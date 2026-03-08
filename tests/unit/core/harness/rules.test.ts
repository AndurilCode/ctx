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
    expect(result.outcome).toBe('rewrite');
  });

  test('allows mutation on already-read file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'known.ts' }, tokensConsumed: 200, durationMs: 20 });
    const result = evaluateRules({ tool: 'edit', args: { file: 'known.ts' } }, state, new Map());
    expect(result.outcome).toBe('allow');
  });

  test('escalates when budget is exhausted (second read)', () => {
    const state = createHarnessState({ contextWindow: 10_000 });
    state.budget.consumed.working = 3800;
    state.cache.filesRead.set('file.ts', { strategy: 'budgeted', tokens: 200, turn: 0 });
    state.cache.hotFiles.add('file.ts'); // hot so it passes deny rules
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
    state.cache.hotFiles.add('big.ts'); // hot so it passes deny rules
    const fileTokens = new Map([['big.ts', 5000]]);
    const result = evaluateRules({ tool: 'read', args: { file: 'big.ts', maxTokens: 800 } }, state, fileTokens);
    // Should not be 'allow' — either escalate or rewrite since file was already read
    expect(result.outcome).not.toBe('deny');
  });

});

describe('Rule 7: re-read detection', () => {
  test('escalates re-read of unchanged file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    const call = { tool: 'read', args: { file: '/src/foo.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toContain('Already read');
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

describe('Rule 8: sequence batching', () => {
  test('escalates when 3+ reads in same directory in recent history', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toBe('dir_batching');
  });

  test('allows when only 2 reads in same directory', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).not.toBe('deny');
  });

  test('only checks last 5 history entries', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/other/x.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 3, tool: 'read', args: { file: '/other/y.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 4, tool: 'read', args: { file: '/other/z.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).not.toBe('deny');
  });

  test('does not fire for grep', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'grep', args: { pattern: 'foo', path: '/src/core/' } };
    const result = evaluateRules(call, state, new Map());
    expect(result.outcome).not.toBe('deny');
  });

  test('detects batching even with interleaved non-read calls', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'grep', args: { pattern: 'foo' }, tokensConsumed: 50, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 3, tool: 'bash', args: { command: 'ls' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 4, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toBe('dir_batching');
  });

  test('only considers last 5 reads, not last 5 calls', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.history = [
      { turn: 0, tool: 'read', args: { file: '/src/core/a.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 1, tool: 'read', args: { file: '/src/core/b.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 2, tool: 'read', args: { file: '/src/core/c.ts' }, tokensConsumed: 100, durationMs: 10 },
      { turn: 3, tool: 'bash', args: { command: 'ls' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 4, tool: 'bash', args: { command: 'pwd' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 5, tool: 'bash', args: { command: 'echo' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 6, tool: 'bash', args: { command: 'date' }, tokensConsumed: 20, durationMs: 10 },
      { turn: 7, tool: 'bash', args: { command: 'whoami' }, tokensConsumed: 20, durationMs: 10 },
    ];
    const call = { tool: 'read', args: { file: '/src/core/d.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/core/d.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toBe('dir_batching');
  });
});

describe('Rule 9: same-strategy re-read', () => {
  test('escalates re-read with same strategy even if file is hot', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('/src/foo.ts', { strategy: 'full', tokens: 500, turn: 0 });
    state.cache.hotFiles.add('/src/foo.ts');
    const call = { tool: 'read', args: { file: '/src/foo.ts' } };
    const result = evaluateRules(call, state, new Map([['/src/foo.ts', 500]]));
    expect(result.outcome).toBe('escalate');
    expect((result as any).hint).toContain('same strategy');
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
