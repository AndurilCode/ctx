import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  loadState, saveState, resetState, resolveStatePath,
  deriveStorePaths, loadStateJournaled, appendStateEvent, compact,
  acquireStoreLock, releaseStoreLock,
} from '../../../../src/core/harness/store.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';
import { appendRecord, readRecords } from '../../../../src/core/harness/journal.js';
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('store', () => {
  const dir = join(tmpdir(), 'harness-store-test-' + process.pid);
  const statePath = join(dir, 'harness-state.json');

  beforeEach(() => { mkdirSync(dir, { recursive: true }); });
  afterEach(() => {
    const paths = deriveStorePaths(statePath);
    try { unlinkSync(statePath); } catch {}
    try { unlinkSync(statePath + '.tmp.' + process.pid); } catch {}
    try { unlinkSync(paths.journalPath); } catch {}
    try { rmdirSync(paths.lockPath); } catch {}
  });

  test('resolveStatePath returns .claude/harness-state.json under cwd', () => {
    expect(resolveStatePath('/my/project')).toBe('/my/project/.claude/harness-state.json');
  });

  test('loadState returns fresh state when no file exists', () => {
    const state = loadState(statePath);
    expect(state.turn).toBe(0);
    expect(state.budget.total).toBe(200_000);
  });

  test('saveState + loadState round-trips', () => {
    const state = createHarnessState({ contextWindow: 100_000 });
    state.turn = 7;
    saveState(statePath, state);
    const loaded = loadState(statePath);
    expect(loaded.turn).toBe(7);
    expect(loaded.budget.total).toBe(100_000);
  });

  test('resetState removes state file and journal', () => {
    const paths = deriveStorePaths(statePath);
    const state = createHarnessState({ contextWindow: 200_000 });
    saveState(statePath, state);
    appendStateEvent(paths, { type: 'downgrade', key: 'rewriteToContext' });
    expect(existsSync(statePath)).toBe(true);
    expect(existsSync(paths.journalPath)).toBe(true);
    resetState(statePath);
    expect(existsSync(statePath)).toBe(false);
    expect(existsSync(paths.journalPath)).toBe(false);
  });
});

describe('deriveStorePaths', () => {
  test('derives journal and lock paths from statePath', () => {
    const paths = deriveStorePaths('/a/b/.claude/harness-state.json');
    expect(paths.statePath).toBe('/a/b/.claude/harness-state.json');
    expect(paths.journalPath).toBe('/a/b/.claude/harness-journal.ndjson');
    expect(paths.lockPath).toBe('/a/b/.claude/harness.lock');
  });
});

describe('journaled store', () => {
  const dir = join(tmpdir(), 'harness-journaled-test-' + process.pid);
  const statePath = join(dir, 'harness-state.json');

  beforeEach(() => { mkdirSync(dir, { recursive: true }); });
  afterEach(() => {
    const paths = deriveStorePaths(statePath);
    try { unlinkSync(statePath); } catch {}
    try { unlinkSync(statePath + '.tmp.' + process.pid); } catch {}
    try { unlinkSync(paths.journalPath); } catch {}
    try { rmdirSync(paths.lockPath); } catch {}
  });

  test('loadStateJournaled returns fresh state when nothing exists', () => {
    const paths = deriveStorePaths(statePath);
    const { state, journalEntries } = loadStateJournaled(paths);
    expect(state.turn).toBe(0);
    expect(journalEntries).toBe(0);
  });

  test('loadStateJournaled replays journal on top of snapshot', () => {
    const paths = deriveStorePaths(statePath);
    const state = createHarnessState({ contextWindow: 200_000 });
    saveState(statePath, state);

    appendRecord(paths.journalPath, {
      type: 'tool_call',
      record: { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 },
    });
    appendRecord(paths.journalPath, {
      type: 'tool_call',
      record: { tool: 'grep', args: { pattern: 'x' }, tokensConsumed: 50, durationMs: 2 },
    });

    const result = loadStateJournaled(paths);
    expect(result.state.turn).toBe(2);
    expect(result.state.history).toHaveLength(2);
    expect(result.journalEntries).toBe(2);
  });

  test('appendStateEvent writes to journal', () => {
    const paths = deriveStorePaths(statePath);
    appendStateEvent(paths, { type: 'downgrade', key: 'rewriteToContext' });
    const records = readRecords(paths.journalPath);
    expect(records).toHaveLength(1);
    expect(records[0].event.type).toBe('downgrade');
  });

  test('compact writes snapshot and truncates journal', () => {
    const paths = deriveStorePaths(statePath);
    const state = createHarnessState({ contextWindow: 200_000 });
    state.turn = 5;
    appendRecord(paths.journalPath, { type: 'downgrade', key: 'rewriteToContext' });

    compact(paths, state);

    expect(existsSync(statePath)).toBe(true);
    expect(readRecords(paths.journalPath)).toEqual([]);
    const loaded = loadStateJournaled(paths);
    expect(loaded.state.turn).toBe(5);
    expect(loaded.journalEntries).toBe(0);
  });

  test('loadState (backward compat) uses journal recovery', () => {
    const paths = deriveStorePaths(statePath);
    saveState(statePath, createHarnessState({ contextWindow: 200_000 }));
    appendRecord(paths.journalPath, {
      type: 'tool_call',
      record: { tool: 'read', args: { file: 'b.ts' }, tokensConsumed: 75, durationMs: 3 },
    });
    const state = loadState(statePath);
    expect(state.turn).toBe(1);
    expect(state.history).toHaveLength(1);
  });
});

describe('store locks', () => {
  const dir = join(tmpdir(), 'harness-lock-store-test-' + process.pid);
  const statePath = join(dir, 'harness-state.json');

  beforeEach(() => { mkdirSync(dir, { recursive: true }); });
  afterEach(() => {
    const paths = deriveStorePaths(statePath);
    try { rmdirSync(paths.lockPath); } catch {}
  });

  test('acquireStoreLock + releaseStoreLock round-trips', () => {
    const paths = deriveStorePaths(statePath);
    const acquired = acquireStoreLock(paths);
    expect(acquired).toBe(true);
    releaseStoreLock(paths);
  });

  test('second acquire fails while lock held', () => {
    const paths = deriveStorePaths(statePath);
    acquireStoreLock(paths);
    const second = acquireStoreLock(paths);
    expect(second).toBe(false);
    releaseStoreLock(paths);
  });
});
