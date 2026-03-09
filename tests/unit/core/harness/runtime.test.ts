import { describe, expect, test, beforeEach } from 'bun:test';
import { evaluate } from '../../../../src/core/harness/runtime.js';
import { createHarnessState } from '../../../../src/core/harness/state.js';
import { saveState, loadState, deriveStorePaths } from '../../../../src/core/harness/store.js';
import { readRecords } from '../../../../src/core/harness/journal.js';
import type { HarnessRequest } from '../../../../src/types/harness.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';

const stateDir = join(tmpdir(), 'harness-runtime-test-' + process.pid);
const statePath = join(stateDir, 'state.json');

function makeRequest(overrides: Partial<HarnessRequest> = {}): HarnessRequest {
  return {
    surface: 'claude-hook',
    event: 'PreToolUse',
    toolClass: 'read',
    toolName: 'Read',
    args: { file: 'test.ts' },
    capabilities: { canBlock: true, canRewrite: false, canInjectContext: true, canReturnCached: false, canInjectBefore: false },
    ...overrides,
  };
}

describe('runtime.evaluate', () => {
  beforeEach(() => {
    mkdirSync(stateDir, { recursive: true });
    try { unlinkSync(statePath); } catch {}
    const paths = deriveStorePaths(statePath);
    try { unlinkSync(paths.journalPath); } catch {}
  });

  test('SessionStart resets state and returns noop', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    saveState(statePath, state);

    const result = await evaluate(makeRequest({ event: 'SessionStart' }), { statePath });
    expect(result.action).toBe('noop');
    expect(existsSync(statePath)).toBe(false);
  });

  test('PreCompact resets state and returns noop', async () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    saveState(statePath, state);

    const result = await evaluate(makeRequest({ event: 'PreCompact' }), { statePath });
    expect(result.action).toBe('noop');
    expect(existsSync(statePath)).toBe(false);
  });

  test('PreToolUse for non-harness tool returns noop', async () => {
    const result = await evaluate(makeRequest({ toolName: 'Bash', toolClass: 'execute' }), { statePath });
    expect(result.action).toBe('noop');
  });

  test('PreToolUse for Read returns allow on first read', async () => {
    const result = await evaluate(makeRequest(), { statePath });
    expect(result.action).toBe('allow');
  });

  test('PreToolUse for Read persists state', async () => {
    await evaluate(makeRequest(), { statePath });
    const state = loadState(statePath);
    expect(state.turn).toBeGreaterThan(0);
  });

  test('Stop returns noop', async () => {
    const result = await evaluate(makeRequest({ event: 'Stop' }), { statePath });
    expect(result.action).toBe('noop');
  });

  test('UserPromptSubmit with prompt profiles state and returns noop', async () => {
    const result = await evaluate(
      makeRequest({ event: 'UserPromptSubmit', prompt: 'fix the bug in auth.ts' }),
      { statePath },
    );
    expect(result.action).toBe('noop');
    const state = loadState(statePath);
    expect(state.profile.type).toBe('targeted_fix');
  });

  test('non-PreToolUse events return noop', async () => {
    const result = await evaluate(makeRequest({ event: 'PostToolUse' }), { statePath });
    expect(result.action).toBe('noop');
  });

  test('Grep returns allow on first call', async () => {
    const result = await evaluate(makeRequest({ toolName: 'Grep', toolClass: 'search', args: { pattern: 'foo', path: 'src/' } }), { statePath });
    expect(result.action).toBe('allow');
  });

  test('Glob returns allow on first call', async () => {
    const result = await evaluate(makeRequest({ toolName: 'Glob', toolClass: 'list', args: { pattern: '*.ts' } }), { statePath });
    expect(result.action).toBe('allow');
  });

  test('PreToolUse for Read appends journal event instead of full snapshot', async () => {
    await evaluate(makeRequest(), { statePath });
    const paths = deriveStorePaths(statePath);
    const records = readRecords(paths.journalPath);
    expect(records.length).toBeGreaterThan(0);
    expect(records.some(r => r.event.type === 'tool_call')).toBe(true);
  });

  test('UserPromptSubmit appends profile_update journal event', async () => {
    await evaluate(
      makeRequest({ event: 'UserPromptSubmit', prompt: 'fix the bug in auth.ts' }),
      { statePath },
    );
    const paths = deriveStorePaths(statePath);
    const records = readRecords(paths.journalPath);
    expect(records.some(r => r.event.type === 'profile_update')).toBe(true);
  });

  test('PostToolUse records actual outcome', async () => {
    await evaluate(makeRequest(), { statePath });
    await evaluate(
      makeRequest({
        event: 'PostToolUse',
        result: { tokens: 80, durationMs: 15, success: true },
      }),
      { statePath },
    );
    const paths = deriveStorePaths(statePath);
    const records = readRecords(paths.journalPath);
    expect(records.some(r => r.event.type === 'tool_outcome')).toBe(true);
  });

  test('SessionStart clears journal file', async () => {
    const paths = deriveStorePaths(statePath);
    await evaluate(makeRequest(), { statePath });
    expect(readRecords(paths.journalPath).length).toBeGreaterThan(0);
    await evaluate(makeRequest({ event: 'SessionStart' }), { statePath });
    expect(readRecords(paths.journalPath)).toEqual([]);
  });
});
