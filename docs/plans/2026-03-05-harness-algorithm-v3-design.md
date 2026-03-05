# Harness Algorithm v3 — Six Correctness & Performance Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix six algorithm issues in the harness: dead cost dimension, outcome recording, incremental signals, read-only batching window, classifier overlap, and feedback loop.

**Architecture:** Three-stage pipeline (rules -> cost -> judge) running as a Claude Code hook. State persists to disk between invocations. No architectural changes — these are fixes to the existing algorithm.

**Tech Stack:** TypeScript (bun), Node.js hooks (.mjs), bun:test

---

### Task 1: Fix dead `wCalls` dimension in cost scoring

The `scoreCost` formula uses `wCalls * 1` for every alternative. Since all alternatives have `roundtrips: 1`, the wCalls dimension adds a constant offset that never differentiates. Fix by giving alternatives realistic roundtrip counts.

**Files:**
- Modify: `src/core/harness/cost.ts:35-63` (generateAlternatives)
- Modify: `tests/unit/core/harness/cost.test.ts`

**Step 1: Update cost tests to expect differentiated roundtrips**

In `tests/unit/core/harness/cost.test.ts`, add a test:

```ts
test('outline alternative has roundtrips=2 (outline + follow-up)', () => {
  const alts = generateAlternatives(
    { tool: 'read', args: { file: 'big.ts' } },
    { fileTokens: 5000, mentionedSymbols: [] },
  );
  const outline = alts.find(a => a.tool === 'outline');
  expect(outline?.roundtrips).toBe(2);
});
```

Update existing tests that assert on roundtrips values if they hardcode `1` for outline.

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/core/harness/cost.test.ts --filter "roundtrips"`
Expected: FAIL (outline currently has roundtrips=1)

**Step 3: Update generateAlternatives with correct roundtrips**

In `src/core/harness/cost.ts`, change the outline alternative:

```ts
// Outline alternative — typically requires a follow-up read
alts.push({
  tool: 'outline',
  args: { file },
  estTokens: Math.max(50, ctx.fileTokens * 0.05),
  roundtrips: 2,
  cost: 0,
});
```

Budgeted read and focus stay at `roundtrips: 1`.

**Step 4: Run tests to verify all pass**

Run: `bun test tests/unit/core/harness/cost.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/core/harness/cost.ts tests/unit/core/harness/cost.test.ts
git commit -m "fix(harness): give outline alternative roundtrips=2 so wCalls differentiates"
```

---

### Task 2: Record outcomes, not attempts

`harness-eval.mjs` records the original call in state even when the decision is `rewrite` or `deny`. This poisons Rule 7/9 re-read detection. Only record when the decision is `allow`.

**Files:**
- Modify: `.claude/hooks/harness-eval.mjs:114-122`
- Modify: `tests/unit/core/harness/hook-integration.test.ts`

**Step 1: Add test for conditional recording**

In `tests/unit/core/harness/hook-integration.test.ts`, add:

```ts
test('rewrite decision does not record the original call in state', () => {
  // Create state with a large file already known
  const state = createHarnessState({ contextWindow: 200_000 });
  const fileTokens = new Map([['big.ts', 5000]]);

  // First read — allowed (Rule 10)
  const call1 = { tool: 'read', args: { file: 'big.ts' } };
  const result1 = evaluateRules(call1, state, fileTokens);
  expect(result1.outcome).toBe('allow');
  recordToolCall(state, { tool: 'read', args: { file: 'big.ts' }, tokensConsumed: 5000, durationMs: 10 });

  // Second read of same file — should be denied (Rule 9, same strategy)
  const call2 = { tool: 'read', args: { file: 'big.ts' } };
  const result2 = evaluateRules(call2, state, fileTokens);
  expect(result2.outcome).toBe('deny');

  // If we had recorded a rewrite as if it were the original call,
  // the cache would be polluted. Verify cache only has one entry.
  expect(state.cache.filesRead.size).toBe(1);
});
```

**Step 2: Update harness-eval.mjs to conditionally record**

In `.claude/hooks/harness-eval.mjs`, wrap the recording logic:

```js
// Only record the call if the harness allows it — rewrites and denies
// should not pollute state since the original call won't execute.
if (decision.action === 'allow') {
  recordToolCall(state, {
    tool: toolName.toLowerCase(),
    args: toolInput ?? {},
    tokensConsumed: estTokens,
    durationMs: 0,
  });
  updateSignals(state);
}
```

**Step 3: Run tests**

Run: `bun test tests/unit/core/harness/`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add .claude/hooks/harness-eval.mjs tests/unit/core/harness/hook-integration.test.ts
git commit -m "fix(harness): only record tool calls on allow decisions"
```

---

### Task 3: Incremental signal updates

`updateSignals` scans the full history array on every call. Move signal tracking into `recordToolCall` for O(1) updates.

**Files:**
- Modify: `src/types/harness.ts` (add `currentReadStreak` to SessionSignals)
- Modify: `src/core/harness/state.ts` (move logic into recordToolCall)
- Modify: `tests/unit/core/harness/state.test.ts`
- Modify: `src/core/harness/serialize.ts` (if needed for new field)

**Step 1: Add `currentReadStreak` to SessionSignals type**

In `src/types/harness.ts`, add to `SessionSignals`:

```ts
export interface SessionSignals {
  sequentialReads: number;      // max consecutive read streak
  currentReadStreak: number;    // current running streak (for incremental tracking)
  budgetConsumedPct: number;
  depthEscalations: number;
  uniqueFilesRead: number;
  mutations: number;
  sameFileRereads: number;
  toolDiversity: number;
}
```

**Step 2: Update tests to verify incremental behavior**

In `tests/unit/core/harness/state.test.ts`, add:

```ts
test('recordToolCall updates signals incrementally', () => {
  const state = createHarnessState({ contextWindow: 200_000 });

  recordToolCall(state, { tool: 'read', args: { file: 'a.ts' }, tokensConsumed: 100, durationMs: 5 });
  expect(state.signals.sequentialReads).toBe(1);
  expect(state.signals.currentReadStreak).toBe(1);
  expect(state.signals.uniqueFilesRead).toBe(1);

  recordToolCall(state, { tool: 'read', args: { file: 'b.ts' }, tokensConsumed: 100, durationMs: 5 });
  expect(state.signals.sequentialReads).toBe(2);
  expect(state.signals.currentReadStreak).toBe(2);

  recordToolCall(state, { tool: 'edit', args: { file: 'a.ts' }, tokensConsumed: 50, durationMs: 5 });
  expect(state.signals.currentReadStreak).toBe(0);
  expect(state.signals.sequentialReads).toBe(2); // max preserved
  expect(state.signals.mutations).toBe(1);

  recordToolCall(state, { tool: 'read', args: { file: 'c.ts' }, tokensConsumed: 100, durationMs: 5 });
  expect(state.signals.currentReadStreak).toBe(1);
  expect(state.signals.sequentialReads).toBe(2); // max still 2
  expect(state.signals.toolDiversity).toBe(2); // read + edit
});
```

**Step 3: Run tests to verify they fail**

Run: `bun test tests/unit/core/harness/state.test.ts --filter "incremental"`
Expected: FAIL

**Step 4: Move signal logic into recordToolCall**

In `src/core/harness/state.ts`, update `recordToolCall`:

```ts
export function recordToolCall(
  state: HarnessState,
  record: Omit<ToolCallRecord, 'turn'>,
): void {
  const turn = state.turn;
  state.history.push({ ...record, turn });
  state.turn += 1;

  state.budget.consumed.working += record.tokensConsumed;

  const file = (record.args['file'] ?? record.args['file_path']) as string | undefined;

  // --- Incremental signal updates ---

  if (READ_TOOLS.has(record.tool)) {
    state.signals.currentReadStreak += 1;
    if (state.signals.currentReadStreak > state.signals.sequentialReads) {
      state.signals.sequentialReads = state.signals.currentReadStreak;
    }
  } else {
    state.signals.currentReadStreak = 0;
  }

  if (READ_TOOLS.has(record.tool) && file) {
    if (state.cache.filesRead.has(file)) {
      state.signals.sameFileRereads += 1;
    }
    state.cache.filesRead.set(file, {
      strategy: 'full',
      tokens: record.tokensConsumed,
      turn,
    });
    state.signals.uniqueFilesRead = state.cache.filesRead.size;
  }

  if (MUTATION_TOOLS.has(record.tool)) {
    state.signals.mutations += 1;
    if (file) state.cache.hotFiles.add(file);
  }

  // Track tool diversity via history length proxy — use a Set scan only
  // on the tool name, not the full history
  if (!state.history.slice(0, -1).some(h => h.tool === record.tool)) {
    state.signals.toolDiversity += 1;
  }

  const alloc = state.budget.allocated.working;
  state.signals.budgetConsumedPct = alloc > 0 ? state.budget.consumed.working / alloc : 0;
}
```

**Step 5: Make updateSignals a no-op (backward compat)**

```ts
/** @deprecated Signals are now updated incrementally in recordToolCall. */
export function updateSignals(_state: HarnessState): void {
  // no-op — kept for backward compatibility with harness-eval.mjs callers
}
```

**Step 6: Initialize currentReadStreak in createHarnessState**

Add `currentReadStreak: 0` to the signals initialization.

**Step 7: Update serialize/deserialize if needed**

Ensure `currentReadStreak` survives JSON roundtrip. Since it's a plain number on SessionSignals, it should serialize automatically. Add a default of `0` in `deserialize` for backward compat with old state files.

**Step 8: Run all tests**

Run: `bun test tests/unit/core/harness/`
Expected: ALL PASS (existing tests should work since updateSignals is still called but no-op)

**Step 9: Commit**

```bash
git add src/types/harness.ts src/core/harness/state.ts tests/unit/core/harness/state.test.ts
git commit -m "perf(harness): incremental signal updates in recordToolCall"
```

---

### Task 4: Read-only window for Rule 8

Rule 8 uses `state.history.slice(-5)` which includes non-read calls. Filter to reads first so directory batching detection survives interleaved calls.

**Files:**
- Modify: `src/core/harness/rules.ts:47-60`
- Modify: `tests/unit/core/harness/rules.test.ts`

**Step 1: Add test for interleaved non-read calls**

In `tests/unit/core/harness/rules.test.ts`, add:

```ts
test('Rule 8 detects batching even with interleaved non-read calls', () => {
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/core/harness/rules.test.ts --filter "interleaved"`
Expected: FAIL (current slice(-5) dilutes the reads)

**Step 3: Update Rule 8 to filter reads first**

In `src/core/harness/rules.ts`, change Rule 8:

```ts
// ---- Rule 8: Sequence batching (3+ reads in same dir) -> advisory ----
if (call.tool === 'read' && file != null) {
  const recentReads = state.history.filter((h) => h.tool === 'read').slice(-5);
  const targetDir = dirname(file);
  const readsInDir = recentReads.filter((h) => {
    const hFile = (h.args['file'] ?? h.args['file_path']) as string | undefined;
    return hFile != null && dirname(hFile) === targetDir;
  });
  if (readsInDir.length >= 3) {
    return {
      outcome: 'escalate',
      hint: 'dir_batching',
    };
  }
}
```

**Step 4: Run all rules tests**

Run: `bun test tests/unit/core/harness/rules.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/core/harness/rules.ts tests/unit/core/harness/rules.test.ts
git commit -m "fix(harness): Rule 8 uses read-only window for batching detection"
```

---

### Task 5: Tighten classifier pinpoint regex

The `pinpoint` pattern matches too broadly — "What does this function do?" classifies as pinpoint instead of exploration.

**Files:**
- Modify: `src/core/harness/classifier.ts:17`
- Modify: `tests/unit/core/harness/classifier.test.ts`

**Step 1: Add test for exploration-style "what" prompts**

In `tests/unit/core/harness/classifier.test.ts`, add:

```ts
test('classifies "what does this function do" as exploration, not pinpoint', () => {
  const result = classifyIntent('what does this function do');
  expect(result.type).toBe('exploration');
});

test('classifies "what is the entry point" as pinpoint', () => {
  const result = classifyIntent('what is the entry point');
  expect(result.type).toBe('pinpoint');
});

test('classifies "where is the config file" as pinpoint', () => {
  const result = classifyIntent('where is the config file');
  expect(result.type).toBe('pinpoint');
});
```

**Step 2: Run tests to verify failure**

Run: `bun test tests/unit/core/harness/classifier.test.ts --filter "what does"`
Expected: FAIL (currently returns pinpoint)

**Step 3: Tighten the pinpoint regex**

In `src/core/harness/classifier.ts`, update the first pattern:

```ts
{ pattern: /^(what|where)\s+(is|are|file|class|function|module|package)\b.{0,50}$/i, type: 'pinpoint', confidence: 0.7 },
```

**Step 4: Check existing pinpoint tests still pass**

Run: `bun test tests/unit/core/harness/classifier.test.ts`
Expected: ALL PASS — verify no existing tests relied on the broad pattern

**Step 5: Commit**

```bash
git add src/core/harness/classifier.ts tests/unit/core/harness/classifier.test.ts
git commit -m "fix(harness): tighten pinpoint classifier to require locator-style patterns"
```

---

### Task 6: Close the feedback loop

Wire `computeMetrics` into the Stop hook and add rewrite compliance tracking.

**Files:**
- Modify: `src/types/harness.ts` (add `pendingRewrite` to HarnessState)
- Modify: `src/core/harness/state.ts` (track rewrite compliance)
- Modify: `src/core/harness/metrics.ts` (add rewrite acceptance rate)
- Modify: `.claude/hooks/harness-eval.mjs` (emit metrics on Stop, set pendingRewrite on rewrite)
- Create: `tests/unit/core/harness/feedback.test.ts`

**Step 1: Add PendingRewrite type and field**

In `src/types/harness.ts`:

```ts
export interface PendingRewrite {
  turn: number;
  suggestedTool: string;
  suggestedArgs: Record<string, unknown>;
}

export interface HarnessState {
  // ... existing fields ...
  pendingRewrite?: PendingRewrite;
  rewriteCompliance: { followed: number; ignored: number };
}
```

Add `rewriteCompliance` to `SerializedHarnessState` too.

**Step 2: Write feedback tests**

```ts
// tests/unit/core/harness/feedback.test.ts
test('rewrite compliance tracks followed suggestions', () => {
  const state = createHarnessState({ contextWindow: 200_000 });
  state.pendingRewrite = { turn: 0, suggestedTool: 'outline', suggestedArgs: { file: 'big.ts' } };

  recordToolCall(state, { tool: 'outline', args: { file: 'big.ts' }, tokensConsumed: 50, durationMs: 5 });
  expect(state.rewriteCompliance.followed).toBe(1);
  expect(state.rewriteCompliance.ignored).toBe(0);
  expect(state.pendingRewrite).toBeUndefined();
});

test('rewrite compliance tracks ignored suggestions', () => {
  const state = createHarnessState({ contextWindow: 200_000 });
  state.pendingRewrite = { turn: 0, suggestedTool: 'outline', suggestedArgs: { file: 'big.ts' } };

  recordToolCall(state, { tool: 'read', args: { file: 'big.ts' }, tokensConsumed: 5000, durationMs: 10 });
  expect(state.rewriteCompliance.followed).toBe(0);
  expect(state.rewriteCompliance.ignored).toBe(1);
  expect(state.pendingRewrite).toBeUndefined();
});

test('computeMetrics includes rewrite acceptance rate', () => {
  const state = createHarnessState({ contextWindow: 200_000 });
  state.rewriteCompliance = { followed: 3, ignored: 1 };
  const metrics = computeMetrics(state);
  expect(metrics.rewriteAcceptanceRate).toBe(0.75);
});
```

**Step 3: Run tests to verify failure**

Run: `bun test tests/unit/core/harness/feedback.test.ts`
Expected: FAIL

**Step 4: Update recordToolCall for compliance tracking**

In `src/core/harness/state.ts`, at the top of `recordToolCall`:

```ts
// Check rewrite compliance before recording
if (state.pendingRewrite) {
  if (record.tool === state.pendingRewrite.suggestedTool) {
    state.rewriteCompliance.followed += 1;
  } else {
    state.rewriteCompliance.ignored += 1;
  }
  state.pendingRewrite = undefined;
}
```

**Step 5: Add rewriteAcceptanceRate to computeMetrics**

In `src/core/harness/metrics.ts`:

```ts
export interface SessionMetrics {
  // ... existing fields ...
  rewriteAcceptanceRate: number;
}

// In computeMetrics:
const total = state.rewriteCompliance.followed + state.rewriteCompliance.ignored;
const rewriteAcceptanceRate = total > 0
  ? state.rewriteCompliance.followed / total
  : 1; // no rewrites suggested = perfect compliance
```

**Step 6: Initialize new fields in createHarnessState**

```ts
rewriteCompliance: { followed: 0, ignored: 0 },
pendingRewrite: undefined,
```

**Step 7: Wire metrics emission into harness-eval.mjs**

Add Stop event handling:

```js
if (event === 'Stop') {
  try {
    const { createHarnessState, deserialize, computeMetrics, acquireLock, releaseLock } = await import(
      new URL('../../dist/index.js', import.meta.url).pathname
    );
    const statePath = `${process.cwd()}/.claude/harness-state.json`;
    const lockPath = `${statePath}.lock`;
    const locked = acquireLock(lockPath, 500);
    if (locked) {
      try {
        const raw = readFileSync(statePath, 'utf8');
        const state = deserialize(JSON.parse(raw));
        const metrics = computeMetrics(state);
        const logPath = `${process.cwd()}/.claude/harness-metrics.log`;
        const { appendFileSync } = await import('node:fs');
        appendFileSync(logPath, JSON.stringify({ timestamp: new Date().toISOString(), taskType: state.profile.type, ...metrics }) + '\n');
      } finally {
        releaseLock(lockPath);
      }
    }
  } catch { /* harness not built */ }
  return null;
}
```

Set pendingRewrite on rewrite decisions:

```js
if (decision.action === 'rewrite') {
  state.pendingRewrite = { turn: state.turn, suggestedTool: decision.tool, suggestedArgs: decision.args };
}
```

**Step 8: Update serialize/deserialize for new fields**

Ensure `pendingRewrite` and `rewriteCompliance` survive JSON roundtrip. Add defaults in `deserialize` for backward compat.

**Step 9: Run all tests**

Run: `bun test tests/unit/core/harness/`
Expected: ALL PASS

**Step 10: Commit**

```bash
git add src/types/harness.ts src/core/harness/state.ts src/core/harness/metrics.ts .claude/hooks/harness-eval.mjs tests/unit/core/harness/feedback.test.ts
git commit -m "feat(harness): close feedback loop with metrics emission and rewrite compliance"
```

---

### Task 7: Verify end-to-end

**Step 1: Run full test suite**

Run: `bun test`
Expected: ALL PASS

**Step 2: Build**

Run: `bun run build`
Expected: clean build

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: harness algorithm v3 fixes"
```
