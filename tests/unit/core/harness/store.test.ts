import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { loadState, saveState, resetState, resolveStatePath } from '../../../../src/core/harness/store.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('store', () => {
  const dir = join(tmpdir(), 'harness-store-test-' + process.pid);
  const statePath = join(dir, 'harness-state.json');

  beforeEach(() => { mkdirSync(dir, { recursive: true }); });
  afterEach(() => {
    try { unlinkSync(statePath); } catch {}
    try { unlinkSync(statePath + '.tmp.' + process.pid); } catch {}
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

  test('resetState removes state file', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    saveState(statePath, state);
    expect(existsSync(statePath)).toBe(true);
    resetState(statePath);
    expect(existsSync(statePath)).toBe(false);
  });
});
