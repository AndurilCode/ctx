// --- Actual Outcome (Phase 3) ---
import type { ToolCallRecord, StrategyProfile, PendingRewrite } from './harness.js';

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
  | { type: 'downgrade'; key: 'rewriteToContext' | 'returnCachedToDeny' | 'injectBeforeToWarn' }
  | { type: 'evidence_invalidated'; file: string }
  | { type: 'evidence_restored'; file: string };
