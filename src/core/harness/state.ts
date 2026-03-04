import type {
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
      budgetConsumedPct: 0,
      depthEscalations: 0,
      uniqueFilesRead: 0,
      mutations: 0,
      sameFileRereads: 0,
      toolDiversity: 0,
    },
    turn: 0,
  };
}

// ---------------------------------------------------------------------------
// recordToolCall
// ---------------------------------------------------------------------------

export function recordToolCall(
  state: HarnessState,
  record: Omit<ToolCallRecord, 'turn'>,
): void {
  const turn = state.turn;
  state.history.push({ ...record, turn });
  state.turn += 1;

  state.budget.consumed.working += record.tokensConsumed;

  const file = record.args['file'] as string | undefined;

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
}

// ---------------------------------------------------------------------------
// updateSignals
// ---------------------------------------------------------------------------

export function updateSignals(state: HarnessState): void {
  const { history } = state;

  let maxSeq = 0;
  let curSeq = 0;
  for (const entry of history) {
    if (READ_TOOLS.has(entry.tool)) {
      curSeq += 1;
      if (curSeq > maxSeq) maxSeq = curSeq;
    } else {
      curSeq = 0;
    }
  }
  state.signals.sequentialReads = maxSeq;

  const alloc = state.budget.allocated.working;
  state.signals.budgetConsumedPct =
    alloc > 0 ? state.budget.consumed.working / alloc : 0;

  state.signals.uniqueFilesRead = state.cache.filesRead.size;

  let mutations = 0;
  const toolSet = new Set<string>();
  for (const entry of history) {
    toolSet.add(entry.tool);
    if (MUTATION_TOOLS.has(entry.tool)) mutations += 1;
  }
  state.signals.mutations = mutations;
  state.signals.toolDiversity = toolSet.size;
}
