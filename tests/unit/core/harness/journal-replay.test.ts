import { describe, expect, test, afterEach } from 'bun:test';
import { appendRecord, readRecords, replayEvent, replayAll, truncateJournal } from '../../../../src/core/harness/journal.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';
import type { JournalEventData } from '../../../../src/types/harness.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

const journalPath = join(tmpdir(), 'journal-replay-test-' + process.pid + '.ndjson');

afterEach(() => {
  try { unlinkSync(journalPath); } catch {}
});

describe('appendRecord + readRecords', () => {
  test('round-trips typed events', () => {
    const event: JournalEventData = {
      type: 'tool_call',
      record: { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 },
    };
    appendRecord(journalPath, event);
    const records = readRecords(journalPath);
    expect(records).toHaveLength(1);
    expect(records[0].event.type).toBe('tool_call');
    expect(records[0].ts).toBeGreaterThan(0);
  });

  test('appends multiple events', () => {
    appendRecord(journalPath, { type: 'profile_update', profile: { type: 'pinpoint', weights: { wTokens: 0.5, wLatency: 0.3, wCalls: 0.2 }, focalFiles: [] } });
    appendRecord(journalPath, { type: 'downgrade', key: 'rewriteToContext' });
    const records = readRecords(journalPath);
    expect(records).toHaveLength(2);
  });

  test('readRecords returns empty for missing file', () => {
    expect(readRecords('/tmp/nonexistent-' + process.pid + '.ndjson')).toEqual([]);
  });
});

describe('replayEvent', () => {
  test('tool_call event applies recordToolCall', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    replayEvent(state, {
      type: 'tool_call',
      record: { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 },
    });
    expect(state.turn).toBe(1);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].tokensConsumed).toBe(100);
  });

  test('tool_outcome event updates history entry', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    replayEvent(state, {
      type: 'tool_call',
      record: { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 },
    });
    replayEvent(state, {
      type: 'tool_outcome',
      turn: 0,
      outcome: { tokens: 80, durationMs: 12, success: true },
    });
    expect(state.history[0].outcome).toEqual({ tokens: 80, durationMs: 12, success: true });
  });

  test('profile_update event sets profile', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const profile = { type: 'pinpoint' as const, weights: { wTokens: 0.5, wLatency: 0.3, wCalls: 0.2 }, focalFiles: ['x.ts'] };
    replayEvent(state, { type: 'profile_update', profile });
    expect(state.profile.type).toBe('pinpoint');
    expect(state.profile.focalFiles).toEqual(['x.ts']);
  });

  test('pending_rewrite event sets pendingRewrite', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    replayEvent(state, {
      type: 'pending_rewrite',
      rewrite: { turn: 3, suggestedTool: 'outline', suggestedArgs: { file: 'a.ts' } },
    });
    expect(state.pendingRewrite?.suggestedTool).toBe('outline');
  });

  test('pending_rewrite with undefined clears it', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    state.pendingRewrite = { turn: 1, suggestedTool: 'x', suggestedArgs: {} };
    replayEvent(state, { type: 'pending_rewrite', rewrite: undefined });
    expect(state.pendingRewrite).toBeUndefined();
  });

  test('downgrade event increments counters', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    replayEvent(state, { type: 'downgrade', key: 'rewriteToContext' });
    replayEvent(state, { type: 'downgrade', key: 'rewriteToContext' });
    replayEvent(state, { type: 'downgrade', key: 'returnCachedToDeny' });
    expect(state.downgrades.rewriteToContext).toBe(2);
    expect(state.downgrades.returnCachedToDeny).toBe(1);
    expect(state.downgrades.total).toBe(3);
  });
});

describe('replayAll', () => {
  test('applies events in order', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    const now = Date.now();
    replayAll(state, [
      { ts: now, event: { type: 'tool_call', record: { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 50, durationMs: 2 } } },
      { ts: now + 1, event: { type: 'tool_call', record: { tool: 'grep', args: { pattern: 'x' }, tokensConsumed: 30, durationMs: 1 } } },
      { ts: now + 2, event: { type: 'downgrade', key: 'rewriteToContext' } },
    ]);
    expect(state.turn).toBe(2);
    expect(state.history).toHaveLength(2);
    expect(state.downgrades.rewriteToContext).toBe(1);
  });
});

describe('truncateJournal', () => {
  test('clears journal file', () => {
    appendRecord(journalPath, { type: 'downgrade', key: 'rewriteToContext' });
    expect(readRecords(journalPath)).toHaveLength(1);
    truncateJournal(journalPath);
    expect(readRecords(journalPath)).toEqual([]);
  });

  test('no-op on missing file', () => {
    truncateJournal('/tmp/nonexistent-' + process.pid + '.ndjson');
    // should not throw
  });
});
