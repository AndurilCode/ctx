import { describe, expect, test } from 'bun:test';
import { createHarnessState, recordToolCall } from '../../../../src/core/harness/state.js';
import { checkMutationEvidence, invalidateEvidence, restoreEvidence, isMutationRequiringEvidence } from '../../../../src/core/harness/evidence.js';
import { evaluateRules } from '../../../../src/core/harness/rules.js';
import { decide } from '../../../../src/core/harness/pipeline.js';

describe('evidence passports', () => {
  test('checkMutationEvidence returns unsafe for unread file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = checkMutationEvidence(state, 'unread.ts');
    expect(result.safe).toBe(false);
    expect(result.requiredReads).toEqual([{ tool: 'read', args: { file: 'unread.ts' } }]);
  });

  test('checkMutationEvidence returns safe for read file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 200, durationMs: 10 });
    expect(checkMutationEvidence(state, 'a.ts').safe).toBe(true);
  });

  test('checkMutationEvidence returns unsafe for stale evidence', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 200, durationMs: 10 });
    recordToolCall(state, { tool: 'edit', args: { file: 'a.ts' }, tokensConsumed: 0, durationMs: 10 });
    const result = checkMutationEvidence(state, 'a.ts');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('stale');
  });

  test('invalidateEvidence marks file as stale', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('a.ts', { strategy: 'full', tokens: 200, turn: 0 });
    invalidateEvidence(state, 'a.ts');
    expect(state.staleReads.has('a.ts')).toBe(true);
  });

  test('restoreEvidence clears staleness after re-read', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.cache.filesRead.set('a.ts', { strategy: 'full', tokens: 200, turn: 0 });
    invalidateEvidence(state, 'a.ts');
    restoreEvidence(state, 'a.ts');
    expect(state.staleReads.has('a.ts')).toBe(false);
  });

  test('read after mutation restores evidence', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 200, durationMs: 10 });
    recordToolCall(state, { tool: 'edit', args: { file: 'a.ts' }, tokensConsumed: 0, durationMs: 10 });
    expect(state.staleReads.has('a.ts')).toBe(true);
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 200, durationMs: 10 });
    expect(state.staleReads.has('a.ts')).toBe(false);
    expect(checkMutationEvidence(state, 'a.ts').safe).toBe(true);
  });

  test('isMutationRequiringEvidence excludes bash', () => {
    expect(isMutationRequiringEvidence('edit')).toBe(true);
    expect(isMutationRequiringEvidence('write')).toBe(true);
    expect(isMutationRequiringEvidence('patch')).toBe(true);
    expect(isMutationRequiringEvidence('bash')).toBe(false);
    expect(isMutationRequiringEvidence('read')).toBe(false);
  });
});

describe('inject_before in pipeline', () => {
  test('pipeline produces inject_before for mutation without evidence', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const result = await decide(
      { tool: 'edit', args: { file: 'new.ts' } },
      state,
      { fileTokens: new Map(), mentionedSymbols: [] },
    );
    expect(result.action).toBe('inject_before');
    if (result.action === 'inject_before') {
      expect(result.calls).toEqual([{ tool: 'read', args: { file: 'new.ts' } }]);
    }
  });

  test('pipeline allows mutation with fresh evidence', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'new.ts' }, tokensConsumed: 200, durationMs: 10 });
    const result = await decide(
      { tool: 'edit', args: { file: 'new.ts' } },
      state,
      { fileTokens: new Map(), mentionedSymbols: [] },
    );
    expect(result.action).toBe('allow');
  });

  test('pipeline produces inject_before for stale evidence', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'x.ts' }, tokensConsumed: 200, durationMs: 10 });
    recordToolCall(state, { tool: 'edit', args: { file: 'x.ts' }, tokensConsumed: 0, durationMs: 10 });
    const result = await decide(
      { tool: 'edit', args: { file: 'x.ts' } },
      state,
      { fileTokens: new Map(), mentionedSymbols: [] },
    );
    expect(result.action).toBe('inject_before');
  });
});
