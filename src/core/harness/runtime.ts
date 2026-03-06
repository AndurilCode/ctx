import type { HarnessRequest, RuntimeResult, JournalEventData } from '../../types/harness.js';
import { recordOutcome } from './state.js';
import {
  deriveStorePaths, loadStateJournaled, appendStateEvent,
  compact, resetState, acquireStoreLock, releaseStoreLock,
} from './store.js';
import { buildProfile } from './classifier.js';
import { computeMetrics } from './metrics.js';
import { appendFileSync } from 'node:fs';
import type { PipelineOptions } from './pipeline.js';
import { appendEntry } from './journal.js';
import { isHarnessTool, mediatePreToolUse } from './runtime-mediate.js';

export interface RuntimeOptions {
  statePath: string;
  metricsPath?: string;
  contextWindow?: number;
  pipelineOptions?: PipelineOptions;
}

const COMPACT_THRESHOLD = 50;

export function emitDowngrade(
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
  const { statePath } = opts;

  // --- SessionStart / PreCompact: reset (idempotent, no lock needed) ---
  if (request.event === 'SessionStart' || request.event === 'PreCompact') {
    resetState(statePath);
    return { action: 'noop' };
  }

  // --- Only handle known state-touching events ---
  const stateEvents = new Set(['UserPromptSubmit', 'PostToolUse', 'Stop', 'PreToolUse']);
  if (!stateEvents.has(request.event)) return { action: 'noop' };

  // --- PreToolUse for non-harness tools: noop without lock ---
  if (request.event === 'PreToolUse' && !isHarnessTool(request.toolName)) {
    return { action: 'noop' };
  }

  // --- Acquire lock for all state-touching paths ---
  const paths = deriveStorePaths(statePath);
  const locked = acquireStoreLock(paths);
  try {
    return await evaluateLocked(request, opts, paths);
  } finally {
    if (locked) releaseStoreLock(paths);
  }
}

async function evaluateLocked(
  request: HarnessRequest,
  opts: RuntimeOptions,
  paths: ReturnType<typeof deriveStorePaths>,
): Promise<RuntimeResult> {
  const contextWindow = opts.contextWindow ?? 200_000;

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
      const lastEntry = state.history[state.history.length - 1];
      if (lastEntry && request.result) {
        const outcome = {
          tokens: request.result.tokens ?? lastEntry.tokensConsumed,
          durationMs: request.result.durationMs ?? lastEntry.durationMs,
          success: request.result.success ?? true,
          error: request.result.error,
        };
        recordOutcome(state, lastEntry.turn, outcome);
        const event: JournalEventData = {
          type: 'tool_outcome', turn: lastEntry.turn, outcome,
        };
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
      if (opts.metricsPath) {
        appendFileSync(opts.metricsPath, JSON.stringify({
          timestamp: new Date().toISOString(),
          taskType: state.profile.type,
          ...metrics,
        }) + '\n');
      }
    } catch { /* harness not available or no state */ }
    return { action: 'noop' };
  }

  // --- PreToolUse: delegate to mediation ---
  const { state, journalEntries } = loadStateJournaled(paths, contextWindow);
  return mediatePreToolUse(request, opts, paths, state, journalEntries);
}
