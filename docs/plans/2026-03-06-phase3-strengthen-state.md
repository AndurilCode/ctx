# Phase 3: Strengthen State — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace best-effort atomic snapshots with lock-backed journaling, snapshot+journal recovery, and actual outcome recording.

**Architecture:** Runtime wraps all state operations in file-lock acquire/release. State mutations emit NDJSON journal events instead of full snapshots. Periodic compaction (every 50 entries) writes a snapshot and truncates the journal. PostToolUse records actual outcomes.

**Tech Stack:** TypeScript, bun:test, node:fs (sync), existing lock.ts (mkdir-based)

---

### Task 1: Add Phase 3 types to harness.ts

**Files:**
- Modify: `src/types/harness.ts`

**Step 1: Add ActualOutcome and JournalEventData types**

After the `PendingRewrite` interface (line ~108), add:

```ts
// --- Actual Outcome (Phase 3) ---
export interface ActualOutcome {
  tokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

// --- Journal Events (Phase 3) ---
export type JournalEventData =
  | { type: 'tool_call'; record: Omit<ToolCallRecord, 'turn'> }
  | { type: 'tool_outcome'; turn: number; outcome: ActualOutcome }
  | { type: 'profile_update'; profile: StrategyProfile }
  | { type: 'pending_rewrite'; rewrite?: PendingRewrite }
  | { type: 'downgrade'; key: 'rewriteToContext' | 'returnCachedToDeny' };
```

**Step 2: Add optional outcome to ToolCallRecord**

In the `ToolCallRecord` interface, add after `durationMs`:

```ts
  outcome?: ActualOutcome;
```

**Step 3: Add optional result to HarnessRequest**

In the `HarnessRequest` interface, add after `taskDescription?`:

```ts
  result?: { tokens?: number; durationMs?: number; success?: boolean; error?: string };
```

**Step 4: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types/harness.ts
git commit -m "feat(harness): add ActualOutcome, JournalEventData, and outcome tracking types"
```

---

### Task 2: Implement journal replay (TDD)

**Files:**
- Create: `tests/unit/core/harness/journal-replay.test.ts`
- Modify: `src/core/harness/journal.ts`

**Step 1: Write failing tests for journal replay**

Create `tests/unit/core/harness/journal-replay.test.ts`:

```ts
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
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/core/harness/journal-replay.test.ts`
Expected: FAIL — functions not exported

**Step 3: Implement journal replay in journal.ts**

Replace `src/core/harness/journal.ts` with:

```ts
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import type { HarnessState, JournalEventData } from '../../types/harness.js';
import { recordToolCall } from './state.js';

// --- Legacy API (kept for downgrade/metrics journal) ---

export interface JournalEntry {
  ts: number;
  event: string;
  data: Record<string, unknown>;
}

export function appendEntry(journalPath: string, entry: JournalEntry): void {
  appendFileSync(journalPath, JSON.stringify(entry) + '\n');
}

export function readJournal(journalPath: string): JournalEntry[] {
  try {
    const raw = readFileSync(journalPath, 'utf8');
    return raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

// --- Phase 3: Typed state journal ---

export interface JournalRecord {
  ts: number;
  event: JournalEventData;
}

export function appendRecord(journalPath: string, event: JournalEventData): void {
  const record: JournalRecord = { ts: Date.now(), event };
  appendFileSync(journalPath, JSON.stringify(record) + '\n');
}

export function readRecords(journalPath: string): JournalRecord[] {
  try {
    const raw = readFileSync(journalPath, 'utf8');
    return raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

export function replayEvent(state: HarnessState, event: JournalEventData): void {
  switch (event.type) {
    case 'tool_call':
      recordToolCall(state, event.record);
      break;
    case 'tool_outcome': {
      const entry = state.history.find(h => h.turn === event.turn);
      if (entry) entry.outcome = event.outcome;
      break;
    }
    case 'profile_update':
      state.profile = event.profile;
      break;
    case 'pending_rewrite':
      state.pendingRewrite = event.rewrite;
      break;
    case 'downgrade':
      state.downgrades[event.key] += 1;
      state.downgrades.total += 1;
      break;
  }
}

export function replayAll(state: HarnessState, records: JournalRecord[]): void {
  for (const r of records) {
    replayEvent(state, r.event);
  }
}

export function truncateJournal(journalPath: string): void {
  try {
    writeFileSync(journalPath, '');
  } catch { /* may not exist */ }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/core/harness/journal-replay.test.ts`
Expected: All PASS

**Step 5: Run existing journal tests to verify backward compat**

Run: `bun test tests/unit/core/harness/journal.test.ts`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/core/harness/journal.ts tests/unit/core/harness/journal-replay.test.ts
git commit -m "feat(harness): implement typed journal events with replay"
```

---

### Task 3: Implement journaled store (TDD)

**Files:**
- Modify: `src/core/harness/store.ts`
- Modify: `tests/unit/core/harness/store.test.ts`

**Step 1: Write failing tests for journaled store**

Replace `tests/unit/core/harness/store.test.ts` with:

```ts
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
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/core/harness/store.test.ts`
Expected: FAIL — new exports not found

**Step 3: Implement journaled store**

Replace `src/core/harness/store.ts` with:

```ts
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { HarnessState, JournalEventData } from '../../types/harness.js';
import { createHarnessState } from './state.js';
import { serialize, deserialize } from './serialize.js';
import { acquireLock, releaseLock } from './lock.js';
import { appendRecord, readRecords, replayAll, truncateJournal } from './journal.js';

// --- Configuration ---

const LOCK_TIMEOUT_MS = 100;

// --- Store Paths ---

export interface StorePaths {
  statePath: string;
  journalPath: string;
  lockPath: string;
}

export function resolveStatePath(cwd: string): string {
  return join(cwd, '.claude', 'harness-state.json');
}

export function deriveStorePaths(statePath: string): StorePaths {
  const dir = dirname(statePath);
  return {
    statePath,
    journalPath: join(dir, 'harness-journal.ndjson'),
    lockPath: join(dir, 'harness.lock'),
  };
}

// --- Snapshot helpers ---

function loadSnapshot(statePath: string, contextWindow: number): HarnessState {
  try {
    const raw = readFileSync(statePath, 'utf8');
    return deserialize(JSON.parse(raw));
  } catch {
    return createHarnessState({ contextWindow });
  }
}

function saveSnapshot(statePath: string, state: HarnessState): void {
  const tmp = statePath + '.tmp.' + process.pid;
  writeFileSync(tmp, JSON.stringify(serialize(state), null, 2));
  renameSync(tmp, statePath);
}

// --- Journaled state operations ---

export function loadStateJournaled(
  paths: StorePaths,
  contextWindow = 200_000,
): { state: HarnessState; journalEntries: number } {
  const state = loadSnapshot(paths.statePath, contextWindow);
  const records = readRecords(paths.journalPath);
  if (records.length > 0) {
    replayAll(state, records);
  }
  return { state, journalEntries: records.length };
}

export function appendStateEvent(paths: StorePaths, event: JournalEventData): void {
  appendRecord(paths.journalPath, event);
}

export function compact(paths: StorePaths, state: HarnessState): void {
  saveSnapshot(paths.statePath, state);
  truncateJournal(paths.journalPath);
}

// --- Lock helpers ---

export function acquireStoreLock(paths: StorePaths): boolean {
  return acquireLock(paths.lockPath, LOCK_TIMEOUT_MS);
}

export function releaseStoreLock(paths: StorePaths): void {
  releaseLock(paths.lockPath);
}

// --- Reset ---

export function resetState(statePath: string): void {
  const paths = deriveStorePaths(statePath);
  try { unlinkSync(paths.statePath); } catch { /* may not exist */ }
  try { unlinkSync(paths.journalPath); } catch { /* may not exist */ }
}

// --- Backward-compatible API ---

export function loadState(statePath: string, contextWindow = 200_000): HarnessState {
  const paths = deriveStorePaths(statePath);
  return loadStateJournaled(paths, contextWindow).state;
}

export function saveState(statePath: string, state: HarnessState): void {
  saveSnapshot(statePath, state);
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/core/harness/store.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/core/harness/store.ts tests/unit/core/harness/store.test.ts
git commit -m "feat(harness): implement lock-backed journaled store with compaction"
```

---

### Task 4: Add recordOutcome to state.ts

**Files:**
- Modify: `src/core/harness/state.ts`
- Modify: `tests/unit/core/harness/state.test.ts`

**Step 1: Read existing state.test.ts to understand patterns**

Read: `tests/unit/core/harness/state.test.ts`

**Step 2: Add failing test for recordOutcome**

Append to `tests/unit/core/harness/state.test.ts`:

```ts
import type { ActualOutcome } from '../../../../src/types/harness.js';

// ... inside the existing describe block or add new one:

describe('recordOutcome', () => {
  test('updates history entry with actual outcome', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 });
    const outcome: ActualOutcome = { tokens: 80, durationMs: 12, success: true };
    recordOutcome(state, 0, outcome);
    expect(state.history[0].outcome).toEqual(outcome);
  });

  test('no-op for nonexistent turn', () => {
    const state = createHarnessState({ contextWindow: 200_000 });
    recordOutcome(state, 99, { tokens: 0, durationMs: 0, success: false, error: 'not found' });
    // should not throw
    expect(state.history).toHaveLength(0);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/unit/core/harness/state.test.ts`
Expected: FAIL — recordOutcome not exported

**Step 4: Add recordOutcome to state.ts**

Add after the `recordToolCall` function:

```ts
// ---------------------------------------------------------------------------
// recordOutcome
// ---------------------------------------------------------------------------

export function recordOutcome(
  state: HarnessState,
  turn: number,
  outcome: ActualOutcome,
): void {
  const entry = state.history.find(h => h.turn === turn);
  if (entry) entry.outcome = outcome;
}
```

Add `ActualOutcome` to the import from `../../types/harness.js`.

**Step 5: Run tests to verify they pass**

Run: `bun test tests/unit/core/harness/state.test.ts`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/core/harness/state.ts tests/unit/core/harness/state.test.ts
git commit -m "feat(harness): add recordOutcome for actual outcome tracking"
```

---

### Task 5: Update runtime to use journaled store (TDD)

**Files:**
- Modify: `src/core/harness/runtime.ts`
- Modify: `tests/unit/core/harness/runtime.test.ts`

**Step 1: Add failing tests for journaled runtime**

Append these tests to `tests/unit/core/harness/runtime.test.ts`:

```ts
import { deriveStorePaths } from '../../../../src/core/harness/store.js';
import { readRecords } from '../../../../src/core/harness/journal.js';

// Add to the existing describe block:

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
  // First do a PreToolUse to create a history entry
  await evaluate(makeRequest(), { statePath });

  // Then PostToolUse with outcome data
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
  // Create some journal state
  await evaluate(makeRequest(), { statePath });
  expect(readRecords(paths.journalPath).length).toBeGreaterThan(0);

  // Reset
  await evaluate(makeRequest({ event: 'SessionStart' }), { statePath });
  expect(readRecords(paths.journalPath)).toEqual([]);
});
```

**Step 2: Run tests to verify new tests fail**

Run: `bun test tests/unit/core/harness/runtime.test.ts`
Expected: New tests FAIL

**Step 3: Rewrite runtime.ts to use journaled store**

Replace `src/core/harness/runtime.ts` with:

```ts
import type { HarnessRequest, RuntimeResult, JournalEventData } from '../../types/harness.js';
import { recordToolCall, recordOutcome } from './state.js';
import {
  deriveStorePaths, loadStateJournaled, appendStateEvent,
  compact, resetState, acquireStoreLock, releaseStoreLock,
} from './store.js';
import { decide } from './pipeline.js';
import { buildProfile } from './classifier.js';
import { computeMetrics } from './metrics.js';
import { appendFileSync, statSync } from 'node:fs';
import type { PipelineOptions } from './pipeline.js';
import { appendEntry } from './journal.js';

export interface RuntimeOptions {
  statePath: string;
  metricsPath?: string;
  contextWindow?: number;
  pipelineOptions?: PipelineOptions;
}

const HARNESS_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const COMPACT_THRESHOLD = 50;

function emitDowngrade(
  opts: RuntimeOptions,
  request: HarnessRequest,
  intended: string,
  actual: string,
  reason: string,
): void {
  if (!opts.metricsPath) return;
  const journalPath = opts.metricsPath.replace(/\.jsonl?$/, '-journal.jsonl');
  try {
    appendEntry(journalPath, {
      ts: Date.now(),
      event: 'downgrade',
      data: { surface: request.surface, intended, actual, reason },
    });
  } catch { /* best-effort */ }
}

export async function evaluate(
  request: HarnessRequest,
  opts: RuntimeOptions,
): Promise<RuntimeResult> {
  const { statePath, contextWindow = 200_000 } = opts;
  const paths = deriveStorePaths(statePath);

  // --- SessionStart / PreCompact: reset (idempotent, no lock needed) ---
  if (request.event === 'SessionStart' || request.event === 'PreCompact') {
    resetState(statePath);
    return { action: 'noop' };
  }

  // --- Only mediate known events ---
  const stateEvents = new Set(['UserPromptSubmit', 'PostToolUse', 'Stop', 'PreToolUse']);
  if (!stateEvents.has(request.event)) return { action: 'noop' };

  // --- Acquire lock for all state-touching paths ---
  const locked = acquireStoreLock(paths);
  try {
    return await evaluateLocked(request, opts, paths, contextWindow);
  } finally {
    if (locked) releaseStoreLock(paths);
  }
}

async function evaluateLocked(
  request: HarnessRequest,
  opts: RuntimeOptions,
  paths: ReturnType<typeof deriveStorePaths>,
  contextWindow: number,
): Promise<RuntimeResult> {
  const { statePath } = opts;
  const journalEvents: JournalEventData[] = [];

  // --- UserPromptSubmit: classify intent ---
  if (request.event === 'UserPromptSubmit' && request.prompt) {
    try {
      const { state, journalEntries } = loadStateJournaled(paths, contextWindow);
      const profile = buildProfile(request.prompt, state.signals);
      state.profile = profile;
      const event: JournalEventData = { type: 'profile_update', profile };
      appendStateEvent(paths, event);
      if (journalEntries + 1 >= COMPACT_THRESHOLD) compact(paths, state);
    } catch { /* harness not available */ }
    return { action: 'noop' };
  }

  // --- PostToolUse: record actual outcome ---
  if (request.event === 'PostToolUse') {
    try {
      const { state, journalEntries } = loadStateJournaled(paths, contextWindow);
      if (state.history.length > 0 && request.result) {
        const lastEntry = state.history[state.history.length - 1];
        const outcome = {
          tokens: request.result.tokens ?? lastEntry.tokensConsumed,
          durationMs: request.result.durationMs ?? lastEntry.durationMs,
          success: request.result.success ?? true,
          error: request.result.error,
        };
        recordOutcome(state, lastEntry.turn, outcome);
        const event: JournalEventData = { type: 'tool_outcome', turn: lastEntry.turn, outcome };
        appendStateEvent(paths, event);
        if (journalEntries + 1 >= COMPACT_THRESHOLD) compact(paths, state);
      }
    } catch { /* harness not available */ }
    return { action: 'noop' };
  }

  // --- Stop: emit metrics ---
  if (request.event === 'Stop') {
    try {
      const { state } = loadStateJournaled(paths, contextWindow);
      const metrics = computeMetrics(state);
      const metricsPath = opts.metricsPath;
      if (metricsPath) {
        appendFileSync(metricsPath, JSON.stringify({
          timestamp: new Date().toISOString(),
          taskType: state.profile.type,
          ...metrics,
        }) + '\n');
      }
    } catch { /* harness not available or no state */ }
    return { action: 'noop' };
  }

  // --- Only mediate PreToolUse ---
  if (request.event !== 'PreToolUse') return { action: 'noop' };

  // --- Only mediate read/search/list tools ---
  if (!HARNESS_TOOLS.has(request.toolName)) return { action: 'noop' };

  const { state, journalEntries } = loadStateJournaled(paths, contextWindow);

  const fileTokens = new Map<string, number>();
  if (request.rawPath) {
    try {
      const stat = statSync(request.rawPath);
      fileTokens.set(request.rawPath, Math.ceil(stat.size / 4));
    } catch { /* file may not exist */ }
  }

  const decision = await decide(
    { tool: request.toolName.toLowerCase(), args: request.args },
    state,
    { fileTokens, mentionedSymbols: [], taskDescription: request.taskDescription },
    opts.pipelineOptions,
  );

  // Record the call if it will execute
  const estTokens = request.rawPath ? (fileTokens.get(request.rawPath) ?? 0) : 0;
  let newEvents = 0;

  if (decision.action !== 'deny' && decision.action !== 'return_cached') {
    const record = {
      tool: request.toolName.toLowerCase(),
      args: request.args,
      tokensConsumed: estTokens,
      durationMs: 0,
    };
    recordToolCall(state, record);
    appendStateEvent(paths, { type: 'tool_call', record });
    newEvents++;
  }

  // --- Translate decision to RuntimeResult with capability awareness ---
  const caps = request.capabilities;

  if (decision.action === 'deny') {
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
    return {
      action: 'deny',
      output: {
        type: 'block',
        value: `[Harness] ${decision.reason} Working budget: ${remaining}/${state.budget.allocated.working} tokens.`,
      },
    };
  }

  if (decision.action === 'return_cached') {
    const cached = decision.result as { file: string; strategy: string; tokens: number; turn: number };
    if (caps.canReturnCached) {
      if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
      return {
        action: 'return_cached',
        output: { type: 'result', file: cached.file, cached: { strategy: cached.strategy, tokens: cached.tokens, turn: cached.turn } },
      };
    }
    state.downgrades.returnCachedToDeny += 1;
    state.downgrades.total += 1;
    appendStateEvent(paths, { type: 'downgrade', key: 'returnCachedToDeny' });
    newEvents++;
    emitDowngrade(opts, request, 'return_cached', 'deny', `Surface ${request.surface} cannot return cached results`);
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
    return {
      action: 'deny',
      output: {
        type: 'block',
        value: `[Harness] Already read ${cached.file} with same strategy (${cached.strategy}) on turn ${cached.turn}. Content is already in context. Working budget: ${remaining}/${state.budget.allocated.working} tokens.`,
      },
    };
  }

  if (decision.action === 'rewrite') {
    state.pendingRewrite = { turn: state.turn, suggestedTool: decision.tool, suggestedArgs: decision.args };
    appendStateEvent(paths, { type: 'pending_rewrite', rewrite: state.pendingRewrite });
    newEvents++;

    if (caps.canRewrite) {
      if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
      return {
        action: 'rewrite',
        output: { type: 'execute', tool: decision.tool, args: decision.args },
      };
    }
    state.downgrades.rewriteToContext += 1;
    state.downgrades.total += 1;
    appendStateEvent(paths, { type: 'downgrade', key: 'rewriteToContext' });
    newEvents++;
    emitDowngrade(opts, request, 'rewrite', 'rewrite', `Surface ${request.surface} cannot execute rewrites; advisory only`);

    const bc = decision.budgetContext;
    let msg = `[Harness] Consider using ${decision.tool} instead`;
    if (bc) {
      msg += ` — saves ~${bc.savedTokens} tokens (${Math.round(bc.savedPct * 100)}%).`;
      msg += `\nWorking budget: ${bc.remainingBudget}/${state.budget.allocated.working} tokens remaining (${bc.pressureLevel} pressure).`;
    } else {
      msg += ' — more token-efficient for this task.';
    }
    if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
    return { action: 'rewrite', output: { type: 'context', value: msg } };
  }

  if (decision.action === 'warn') {
    if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
    return { action: 'warn', output: { type: 'context', value: `[Harness] ${decision.message}` } };
  }

  if (journalEntries + newEvents >= COMPACT_THRESHOLD) compact(paths, state);
  return { action: 'allow' };
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/core/harness/runtime.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/core/harness/runtime.ts tests/unit/core/harness/runtime.test.ts
git commit -m "feat(harness): runtime uses lock-backed journaled store with outcome recording"
```

---

### Task 6: Update index exports

**Files:**
- Modify: `src/core/harness/index.ts`

**Step 1: Add new exports**

Add to `src/core/harness/index.ts`:

```ts
export { recordOutcome } from './state.js';
export { appendRecord, readRecords, replayEvent, replayAll, truncateJournal } from './journal.js';
export type { JournalRecord } from './journal.js';
export { deriveStorePaths, loadStateJournaled, appendStateEvent, compact, acquireStoreLock, releaseStoreLock } from './store.js';
export type { StorePaths } from './store.js';
```

**Step 2: Verify full test suite passes**

Run: `bun test tests/unit/core/harness/`
Expected: All PASS

**Step 3: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/harness/index.ts
git commit -m "feat(harness): export Phase 3 journal and store APIs"
```

---

### Task 7: Integration verification

**Step 1: Run full harness test suite**

Run: `bun test tests/unit/core/harness/`
Expected: All PASS (all existing + new tests)

**Step 2: Build dist and verify harness-eval.mjs works**

Run: `bun run build`
Expected: Clean build

**Step 3: Final commit if any fixups needed**

```bash
git add -A && git commit -m "fix(harness): Phase 3 integration fixups" # only if needed
```
