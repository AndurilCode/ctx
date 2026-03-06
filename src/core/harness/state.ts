import type {
  ActualOutcome,
  BudgetZones,
  HarnessState,
  StrategyProfile,
  ToolCallRecord,
} from '../../types/harness.js';
import { DEFAULT_PROFILE, MUTATION_TOOLS, READ_TOOLS, ZONE_PCT } from './constants.js';

// Re-export everything consumers need from a single entry point
export { MUTATION_TOOLS, READ_TOOLS } from './constants.js';
export { serialize, deserialize } from './serialize.js';

// ---------------------------------------------------------------------------
// createHarnessState
// ---------------------------------------------------------------------------

export function createHarnessState(opts: {
  contextWindow: number;
  profile?: StrategyProfile;
}): HarnessState {
  const total = opts.contextWindow;
  const profile = opts.profile ?? { ...DEFAULT_PROFILE };

  const allocated: BudgetZones = {
    system: Math.round(total * ZONE_PCT.system),
    starter: Math.round(total * ZONE_PCT.starter),
    working: Math.round(total * ZONE_PCT.working),
    output: Math.round(total * ZONE_PCT.output),
    safety: Math.round(total * ZONE_PCT.safety),
  };

  const consumed: BudgetZones = {
    system: 0, starter: 0, working: 0, output: 0, safety: 0,
  };

  return {
    profile,
    budget: { total, allocated, consumed },
    cache: {
      filesRead: new Map(),
      symbolsSeen: new Set(),
      rankResults: new Map(),
      hotFiles: new Set(),
    },
    history: [],
    signals: {
      sequentialReads: 0,
      currentReadStreak: 0,
      budgetConsumedPct: 0,
      depthEscalations: 0,
      uniqueFilesRead: 0,
      mutations: 0,
      sameFileRereads: 0,
      toolDiversity: 0,
    },
    turn: 0,
    rewriteCompliance: { followed: 0, ignored: 0 },
    downgrades: { rewriteToContext: 0, returnCachedToDeny: 0, total: 0 },
  };
}

// ---------------------------------------------------------------------------
// recordToolCall
// ---------------------------------------------------------------------------

export function recordToolCall(
  state: HarnessState,
  record: Omit<ToolCallRecord, 'turn'>,
): void {
  // Check rewrite compliance before recording
  if (state.pendingRewrite) {
    if (record.tool === state.pendingRewrite.suggestedTool) {
      state.rewriteCompliance.followed += 1;
    } else {
      state.rewriteCompliance.ignored += 1;
    }
    state.pendingRewrite = undefined;
  }

  const turn = state.turn;
  state.history.push({ ...record, turn });
  state.turn += 1;

  state.budget.consumed.working += record.tokensConsumed;

  const file = (record.args['file'] ?? record.args['file_path']) as string | undefined;

  if (READ_TOOLS.has(record.tool) && file) {
    if (state.cache.filesRead.has(file)) {
      state.signals.sameFileRereads += 1;
    }
    state.cache.filesRead.set(file, {
      strategy: 'full',
      tokens: record.tokensConsumed,
      turn,
    });
  }

  if (MUTATION_TOOLS.has(record.tool) && file) {
    state.cache.hotFiles.add(file);
  }

  // --- Incremental signal updates ---

  // Sequential reads tracking
  if (READ_TOOLS.has(record.tool)) {
    state.signals.currentReadStreak += 1;
    if (state.signals.currentReadStreak > state.signals.sequentialReads) {
      state.signals.sequentialReads = state.signals.currentReadStreak;
    }
  } else {
    state.signals.currentReadStreak = 0;
  }

  // Mutations
  if (MUTATION_TOOLS.has(record.tool)) {
    state.signals.mutations += 1;
  }

  // Unique files read (already tracked via filesRead.size)
  state.signals.uniqueFilesRead = state.cache.filesRead.size;

  // Tool diversity — check if this tool type was seen before in history
  // (history already includes the current record at this point)
  const isNewTool = !state.history.slice(0, -1).some(h => h.tool === record.tool);
  if (isNewTool) {
    state.signals.toolDiversity += 1;
  }

  // Budget consumed percentage
  const alloc = state.budget.allocated.working;
  state.signals.budgetConsumedPct = alloc > 0 ? state.budget.consumed.working / alloc : 0;
}

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

// ---------------------------------------------------------------------------
// updateSignals
// ---------------------------------------------------------------------------

/** @deprecated Signals are now updated incrementally in recordToolCall. */
export function updateSignals(_state: HarnessState): void {
  // no-op — kept for backward compatibility with harness-eval.mjs callers
}
