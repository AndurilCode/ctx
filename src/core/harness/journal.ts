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
    case 'downgrade': {
      const counters = state.downgrades;
      const key = event.key;
      if (key === 'rewriteToContext') counters.rewriteToContext += 1;
      else if (key === 'returnCachedToDeny') counters.returnCachedToDeny += 1;
      else if (key === 'injectBeforeToWarn') counters.injectBeforeToWarn += 1;
      counters.total += 1;
      break;
    }
    case 'evidence_invalidated':
      state.staleReads.add(event.file);
      break;
    case 'evidence_restored':
      state.staleReads.delete(event.file);
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
