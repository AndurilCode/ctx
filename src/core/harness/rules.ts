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

  // ---- Rule 1: Tiny files — always allow ----
  if (call.tool === 'read' && tokens < 200) {
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

  // ---- Rule 7+9: Re-read detection ----
  if (call.tool === 'read' && file != null && state.cache.filesRead.has(file)) {
    const cached = state.cache.filesRead.get(file)!;
    const currentStrategy = call.args['maxTokens'] != null ? 'budgeted'
      : call.args['offset'] != null ? 'partial'
      : 'full';

    // Rule 9: same strategy re-read — always deny (even if hot)
    if (cached.strategy === currentStrategy) {
      return {
        outcome: 'deny',
        reason: `Already read ${file} with same strategy (${currentStrategy}) on turn ${cached.turn}. Content is already in context.`,
      };
    }

    // Rule 7: different strategy but unchanged file — deny
    if (!state.cache.hotFiles.has(file)) {
      return {
        outcome: 'deny',
        reason: `Already read ${file} on turn ${cached.turn}. Use cached content or outline() for a refresher.`,
      };
    }
    // Hot file + different strategy = allow (valid re-read after mutation)
  }

  // ---- Rule 8: Sequence batching (3+ reads in same dir) ----
  if (call.tool === 'read' && file != null) {
    const recent = state.history.slice(-5);
    const targetDir = dirname(file);
    const readsInDir = recent.filter((h) => {
      const hFile = (h.args['file'] ?? h.args['file_path']) as string | undefined;
      return h.tool === 'read' && hFile != null && dirname(hFile) === targetDir;
    });
    if (readsInDir.length >= 3) {
      return {
        outcome: 'deny',
        reason: `${readsInDir.length} reads in ${targetDir}/ — use gather() or context() to batch.`,
      };
    }
  }

  // ---- Rule 6: Default — allow ----
  return { outcome: 'allow' };
}
