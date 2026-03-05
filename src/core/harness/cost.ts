import type {
  BudgetContext,
  BudgetState,
  CostWeights,
  InterceptedCall,
  ScoredAlternative,
  StageResult,
} from '../../types/harness.js';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export interface CostContext {
  fileTokens: number;
  mentionedSymbols: string[];
}

// ---------------------------------------------------------------------------
// generateAlternatives
// ---------------------------------------------------------------------------

export function generateAlternatives(
  call: InterceptedCall,
  ctx: CostContext,
): ScoredAlternative[] {
  if (call.tool !== 'read' || ctx.fileTokens <= 500) {
    return [];
  }

  const file = call.args['file'] as string;
  const alts: ScoredAlternative[] = [];

  // Outline alternative
  alts.push({
    tool: 'outline',
    args: { file },
    estTokens: Math.max(50, ctx.fileTokens * 0.05),
    roundtrips: 1,
    cost: 0,
  });

  // Budgeted read alternative
  alts.push({
    tool: 'read',
    args: { file, maxTokens: ctx.fileTokens / 3 },
    estTokens: ctx.fileTokens / 3,
    roundtrips: 1,
    cost: 0,
  });

  // Focus alternative (only when symbols are mentioned)
  if (ctx.mentionedSymbols.length > 0) {
    alts.push({
      tool: 'focus',
      args: { file, symbol: ctx.mentionedSymbols[0] },
      estTokens: 400,
      roundtrips: 1,
      cost: 0,
    });
  }

  return alts;
}

// ---------------------------------------------------------------------------
// scoreCost
// ---------------------------------------------------------------------------

export function scoreCost(
  alt: { estTokens: number; roundtrips: number },
  weights: CostWeights,
): number {
  return weights.wTokens * alt.estTokens + weights.wLatency * alt.roundtrips + weights.wCalls * 1;
}

// ---------------------------------------------------------------------------
// evaluateCost
// ---------------------------------------------------------------------------

export function evaluateCost(
  call: InterceptedCall,
  weights: CostWeights,
  ctx: CostContext,
  budgetState?: BudgetState,
): StageResult {
  const alts = generateAlternatives(call, ctx);

  if (alts.length === 0) {
    return { outcome: 'allow' };
  }

  // Score original call
  const originalCost = scoreCost(
    { estTokens: ctx.fileTokens, roundtrips: 1 },
    weights,
  );

  // Score each alternative
  for (const alt of alts) {
    alt.cost = scoreCost(alt, weights);
  }

  // Find best alternative (lowest cost)
  const best = alts.reduce((a, b) => (a.cost < b.cost ? a : b));

  const savingsPct = (originalCost - best.cost) / originalCost;

  // Build budget context when budget info is available
  const budgetContext = budgetState ? buildBudgetContext(ctx.fileTokens, best.estTokens, budgetState) : undefined;

  if (savingsPct > 0.3) {
    return { outcome: 'rewrite', tool: best.tool, args: best.args, budgetContext };
  }

  if (savingsPct >= 0.1) {
    return { outcome: 'escalate', alternatives: alts, budgetContext };
  }

  return { outcome: 'allow' };
}

function buildBudgetContext(
  originalTokens: number,
  altTokens: number,
  budgetState: BudgetState,
): BudgetContext {
  const savedTokens = Math.round(originalTokens - altTokens);
  const savedPct = originalTokens > 0 ? savedTokens / originalTokens : 0;
  const remaining = budgetState.allocated.working - budgetState.consumed.working;
  const allocated = budgetState.allocated.working;
  const pressureLevel: BudgetContext['pressureLevel'] =
    remaining < allocated * 0.2 ? 'high'
    : remaining < allocated * 0.5 ? 'medium'
    : 'low';
  return { savedTokens, savedPct, remainingBudget: remaining, pressureLevel };
}
