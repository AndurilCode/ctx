import type { HarnessState, SerializedHarnessState } from '../../types/harness.js';

export function serialize(state: HarnessState): SerializedHarnessState {
  const filesRead: SerializedHarnessState['cache']['filesRead'] = {};
  for (const [k, v] of state.cache.filesRead) {
    filesRead[k] = v;
  }

  const rankResults: Record<string, string[]> = {};
  for (const [k, v] of state.cache.rankResults) {
    rankResults[k] = v;
  }

  return {
    profile: state.profile,
    budget: state.budget,
    cache: {
      filesRead,
      symbolsSeen: [...state.cache.symbolsSeen],
      rankResults,
      hotFiles: [...state.cache.hotFiles],
    },
    history: state.history,
    signals: state.signals,
    turn: state.turn,
    pendingRewrite: state.pendingRewrite,
    rewriteCompliance: state.rewriteCompliance,
    staleReads: [...state.staleReads],
    downgrades: state.downgrades,
  };
}

export function deserialize(s: SerializedHarnessState): HarnessState {
  return {
    profile: s.profile,
    budget: s.budget,
    cache: {
      filesRead: new Map(Object.entries(s.cache.filesRead)),
      symbolsSeen: new Set(s.cache.symbolsSeen),
      rankResults: new Map(Object.entries(s.cache.rankResults)),
      hotFiles: new Set(s.cache.hotFiles),
    },
    history: s.history,
    signals: { ...s.signals, currentReadStreak: s.signals.currentReadStreak ?? 0 },
    turn: s.turn,
    pendingRewrite: s.pendingRewrite,
    rewriteCompliance: s.rewriteCompliance ?? { followed: 0, ignored: 0 },
    staleReads: new Set(s.staleReads ?? []),
    downgrades: s.downgrades ?? { rewriteToContext: 0, returnCachedToDeny: 0, injectBeforeToWarn: 0, total: 0 },
  };
}
