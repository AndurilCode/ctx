# Phase 3: Strengthen State — Design

**Date:** 2026-03-06
**ADR:** `docs/adr/2026-03-06-context-kernel-runtime.md` (Phase 3)
**Scope:** journal.ts, store.ts, runtime.ts, state.ts, types/harness.ts, index.ts

## Goal

Replace best-effort atomic snapshots with lock-backed journaling. Record actual outcomes. Keep hot-path overhead under 10ms p50 / 25ms p95.

## Approach

Lock-wrapped journal with in-store compaction (Approach A from brainstorming).

- `store.ts` derives `journalPath` and `lockPath` from `statePath`
- Runtime acquires lock → loads snapshot + replays journal → decides → appends journal event → maybe compacts → releases lock
- Compaction at 50 entries
- Zero adapter changes (harness-eval.mjs untouched)

## Types (types/harness.ts)

```ts
export interface ActualOutcome {
  tokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export type JournalEventData =
  | { type: 'tool_call'; record: Omit<ToolCallRecord, 'turn'> }
  | { type: 'tool_outcome'; turn: number; outcome: ActualOutcome }
  | { type: 'profile_update'; profile: StrategyProfile }
  | { type: 'pending_rewrite'; rewrite?: PendingRewrite }
  | { type: 'downgrade'; key: 'rewriteToContext' | 'returnCachedToDeny' };
```

`ToolCallRecord` gains optional `outcome?: ActualOutcome`.
`HarnessRequest` gains optional `result?: { tokens?: number; durationMs?: number; success?: boolean; error?: string }`.

## Journal (journal.ts)

Keep existing `JournalEntry`/`appendEntry`/`readJournal` for downgrade/metrics journal.

Add:

- `JournalRecord { ts, event: JournalEventData }`
- `appendRecord(journalPath, event)` — append typed event
- `readRecords(journalPath)` — read typed records
- `replayEvent(state, event)` — apply single event via same mutation functions (recordToolCall, etc.)
- `replayAll(state, records)` — apply all
- `truncateJournal(journalPath)` — clear after compaction

## Store (store.ts)

```ts
interface StorePaths { statePath; journalPath; lockPath }

deriveStorePaths(statePath): StorePaths
loadStateJournaled(paths, contextWindow?): { state, journalEntries }
appendStateEvent(paths, event): void
compact(paths, state): void
resetState(statePath): void  // clears journal too
acquireStoreLock(paths): boolean
releaseStoreLock(paths): void
```

Constants: `LOCK_TIMEOUT_MS = 100`, `COMPACT_THRESHOLD = 50`.

Backward-compat: `loadState` internally uses journaled load. `saveState` writes full snapshot. `resolveStatePath` unchanged.

## Runtime (runtime.ts)

All state-touching paths wrapped in lock acquire/release:

- **SessionStart/PreCompact**: resetState (idempotent, no lock)
- **UserPromptSubmit**: load → profile update → appendStateEvent(profile_update) → maybe compact
- **PostToolUse** (new): load → find history entry → update with actual outcome → appendStateEvent(tool_outcome) → maybe compact
- **Stop**: load → computeMetrics → write metrics (read-only, no journal event)
- **PreToolUse**: load → decide → recordToolCall → appendStateEvent(tool_call) + optional downgrade/pending_rewrite events → maybe compact

Fallback: if lock acquisition fails, proceed without lock (degraded).

## Testing

- **New: journal-replay.test.ts** — replayEvent per type, replayAll ordering, round-trip, truncate
- **Updated: store.test.ts** — deriveStorePaths, journaled load, compaction, reset clears journal, backward compat
- **Updated: runtime.test.ts** — journal events instead of snapshots, PostToolUse outcome, compaction trigger, lock lifecycle
