# Context Harness v2: Session-Aware Rules & Blocking

## Goal

Evolve the harness from per-call advisory to session-aware enforcement. Add re-read detection, sequence batching, and blocking mode — three incremental layers on top of the existing rule engine.

## Approach: Signal-Driven Rules (B)

Add new rules to the existing Stage 1 engine that check accumulated session state. Rules use signals and context (not just raw counts) to avoid false positives. No new stages or architecture — just smarter rules.

## New Rules

### Rule 7: Re-read Detection

- **Trigger:** `filesRead.has(file)` AND file is NOT in `hotFiles` (not mutated since last read)
- **Action:** Deny — "Already read on turn N. Use the cached content or outline() for a refresher."
- **Exception:** If file IS in `hotFiles`, allow — the agent edited it, re-reading is valid.

### Rule 8: Sequence Batching

- **Trigger:** Look at last 5 history entries. If 3+ Read calls share a parent directory, deny.
- **Action:** Deny — "3 reads in src/core/ — use gather() or context() to batch."
- **Scope:** Only fires on Read tool, not Grep/Glob (those are already batched by nature).

### Rule 9: Same-Strategy Re-read

- **Trigger:** `filesRead.has(file)` AND cached read used the same strategy (e.g., full read twice).
- **Action:** Deny — blocks re-read even if file is in `hotFiles` (agent already knows content from its own edit).
- **Exception:** Allow if strategy differs (e.g., outline first, then full read = valid escalation).

## Blocking Mode

### Output Path Split

- **Advisory** (existing rules 1-6): Continue returning `additionalContext` string. Rewrites are suggestions.
- **Deny** (new rules 7-9): Return structured block that maps to `permissionDecision: 'deny'`. Tool call is blocked, agent sees the reason.

### DecisionAction Extension

Add `action: 'deny'` with a `reason` field to `DecisionAction` type. New rules return deny outcomes. The hook maps these to the block output path already supported by `context-inject.mjs`.

### Hook Integration

`harness-eval.mjs` returns structured results:
- `{ type: 'context', value: '...' }` — advisory (existing)
- `{ type: 'block', value: '...' }` — deny (new)

`context-inject.mjs` already handles both via its `blocks` and `contexts` arrays. No changes to `platform.mjs` needed.

## State Tracking Fix

### Problem

The hook creates state and persists it, but never calls `recordToolCall()` — so `filesRead`, `history`, and `signals` are always empty. New rules depend on accumulated state.

### Fix

After `decide()` returns, call `recordToolCall()` and `updateSignals()` before persisting:

```
decide() -> result
recordToolCall(state, { tool, args, tokensConsumed, durationMs })
updateSignals(state)
serialize -> write harness-state.json
```

Also normalize `file`/`file_path` in `recordToolCall()` (same bug already fixed in rules/pipeline).

### Session Scoping

No cross-session persistence. State file is cleared on SessionStart (hook clears harness-state.json). Each session accumulates fresh.

## Summary

| Layer | Rules | Action | Depends On |
|-------|-------|--------|------------|
| Re-read detection | Rule 7 | Deny | `filesRead`, `hotFiles` |
| Same-strategy re-read | Rule 9 | Deny | `filesRead` (strategy field) |
| Sequence batching | Rule 8 | Deny | `history` (last 5 entries) |
| State tracking | — | — | `recordToolCall()`, `updateSignals()` |
| Blocking output | — | Deny | Hook output path |
| Session scoping | — | — | SessionStart hook |
