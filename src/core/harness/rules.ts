import { dirname } from 'node:path';
import type { HarnessState, InterceptedCall, StageResult } from '../../types/harness.js';
import { MUTATION_TOOLS, READ_TOOLS } from './constants.js';

/**
 * Stage 1: deterministic rule engine.
 *
 * Evaluates rules in priority order — first match wins.
 * All rules are pure (no side-effects) and synchronous.
 */
export function evaluateRules(
  call: InterceptedCall,
  state: HarnessState,
  fileTokens: Map<string, number>,
): StageResult {
  const file = (call.args['file'] ?? call.args['file_path']) as string | undefined;
  const tokens = file ? (fileTokens.get(file) ?? 0) : 0;

  // ---- Session-aware deny rules (highest priority) ----

  // ---- Rule 7+9: Re-read detection ----
  if (call.tool === 'read' && file != null && state.cache.filesRead.has(file)) {
    const cached = state.cache.filesRead.get(file)!;
    const currentStrategy = call.args['maxTokens'] != null ? 'budgeted'
      : call.args['offset'] != null ? 'partial'
      : 'full';

    // Rule 9: same strategy re-read — advisory (allow but warn)
    if (cached.strategy === currentStrategy) {
      return {
        outcome: 'escalate',
        hint: `reread_same_strategy: Already read ${file} with same strategy (${currentStrategy}) on turn ${cached.turn}. Content may already be in context.`,
      };
    }

    // Rule 7: different strategy but unchanged file — advisory
    if (!state.cache.hotFiles.has(file)) {
      return {
        outcome: 'escalate',
        hint: `reread_unchanged: Already read ${file} on turn ${cached.turn}. Consider using cached content or outline() for a refresher.`,
      };
    }
    // Hot file + different strategy = allow (valid re-read after mutation)
  }

  // ---- Rule 8: Sequence batching (3+ reads in same dir) → advisory ----
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

  // ---- Per-call rules ----

  // ---- Rule 1: Tiny files — always allow ----
  if (call.tool === 'read' && tokens < 200) {
    return { outcome: 'allow' };
  }

  // ---- Rule 10: First-read pass-through ----
  if (call.tool === 'read' && file != null && !state.cache.filesRead.has(file)) {
    return { outcome: 'allow' };
  }

  // ---- Rule 2: Large file without budget constraints ----
  if (
    call.tool === 'read' &&
    tokens > 2000 &&
    call.args['maxTokens'] == null &&
    call.args['offset'] == null
  ) {
    return { outcome: 'escalate', hint: 'large_file_no_budget' };
  }

  // ---- Rule 3: Unscoped grep → rewrite to rank ----
  if (
    call.tool === 'grep' &&
    call.args['path'] == null &&
    call.args['glob'] == null
  ) {
    return {
      outcome: 'rewrite',
      tool: 'rank',
      args: { query: call.args['pattern'] as string, maxResults: 5 },
    };
  }

  // ---- Rule 4: Mutation without prior read ----
  if (
    MUTATION_TOOLS.has(call.tool) &&
    file != null &&
    !state.cache.filesRead.has(file)
  ) {
    return {
      outcome: 'rewrite',
      tool: 'read',
      args: { file },
    };
  }

  // ---- Rule 5: Budget overflow ----
  if (READ_TOOLS.has(call.tool)) {
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    if (tokens > remaining) {
      return { outcome: 'escalate', hint: 'budget_pressure' };
    }
  }

  // ---- Rule 6: Default — allow ----
  return { outcome: 'allow' };
}
