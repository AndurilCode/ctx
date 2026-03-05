import type {
  DecisionAction,
  HarnessState,
  InterceptedCall,
  ScoredAlternative,
  StageResult,
} from '../../types/harness.js';
import { evaluateRules } from './rules.js';
import { evaluateCost } from './cost.js';
import { evaluateWithJudge } from './judge.js';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export interface PipelineContext {
  fileTokens: Map<string, number>;
  mentionedSymbols: string[];
  taskDescription?: string;
}

export interface PipelineOptions {
  llmCall?: (prompt: string) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable summary of what the harness has already cached.
 * Used as context for the LLM judge in Stage 3.
 */
export function buildCacheSummary(state: HarnessState): string {
  const { filesRead } = state.cache;

  if (filesRead.size === 0) {
    return 'nothing yet';
  }

  const parts: string[] = [];
  for (const [path, entry] of filesRead) {
    parts.push(`${path} ${entry.strategy} (${entry.tokens} tokens, turn ${entry.turn})`);
  }

  return parts.join('; ');
}

/**
 * Convert a non-escalate StageResult into a DecisionAction.
 *
 * Precondition: result.outcome !== 'escalate'
 */
function toDecisionAction(result: StageResult): DecisionAction {
  if (result.outcome === 'rewrite') {
    return { action: 'rewrite', tool: result.tool, args: result.args, budgetContext: result.budgetContext };
  }
  if (result.outcome === 'deny') {
    return { action: 'deny', reason: result.reason };
  }
  return { action: 'allow' };
}

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Three-stage decision pipeline.
 *
 * 1. **Rules** — deterministic, fast, no side-effects.
 * 2. **Cost** — generates alternatives and scores them.
 * 3. **Judge** — LLM-backed tie-breaker (optional).
 * 4. **Fallback** — pick cheapest alternative or allow.
 */
export async function decide(
  call: InterceptedCall,
  state: HarnessState,
  ctx: PipelineContext,
  opts?: PipelineOptions,
): Promise<DecisionAction> {
  // ── Stage 1: deterministic rules ──────────────────────────────────
  const rulesResult = evaluateRules(call, state, ctx.fileTokens);
  if (rulesResult.outcome !== 'escalate') {
    return toDecisionAction(rulesResult);
  }

  // ── Stage 2: cost analysis ────────────────────────────────────────
  const file = (call.args['file'] ?? call.args['file_path']) as string | undefined;
  const costResult = evaluateCost(call, state.profile.weights, {
    fileTokens: file ? (ctx.fileTokens.get(file) ?? 0) : 0,
    mentionedSymbols: ctx.mentionedSymbols,
  }, state.budget);

  if (costResult.outcome !== 'escalate') {
    return toDecisionAction(costResult);
  }

  // ── Stage 3: LLM judge (optional) ────────────────────────────────
  const alternatives: ScoredAlternative[] = costResult.alternatives ?? [];

  if (opts?.llmCall) {
    const judgeResult = await evaluateWithJudge(
      call,
      {
        taskDescription: ctx.taskDescription ?? 'unknown task',
        cacheSummary: buildCacheSummary(state),
        alternatives,
      },
      opts.llmCall,
    );
    return toDecisionAction(judgeResult);
  }

  // ── Fallback: no LLM available ────────────────────────────────────
  if (alternatives.length > 0) {
    const best = alternatives.reduce((a, b) => (a.cost < b.cost ? a : b));
    return { action: 'rewrite', tool: best.tool, args: best.args };
  }

  return { action: 'allow' };
}
