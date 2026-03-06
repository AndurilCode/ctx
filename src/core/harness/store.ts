import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { HarnessState, JournalEventData } from '../../types/harness.js';
import { createHarnessState } from './state.js';
import { serialize, deserialize } from './serialize.js';
import { acquireLock, releaseLock } from './lock.js';
import { appendRecord, readRecords, replayAll, truncateJournal } from './journal.js';

// --- Store Paths ---

export interface StorePaths {
  statePath: string;
  journalPath: string;
  lockPath: string;
}

const LOCK_TIMEOUT_MS = 100;

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
