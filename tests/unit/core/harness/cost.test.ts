import { describe, expect, test } from 'bun:test';
import { generateAlternatives, scoreCost, evaluateCost } from '../../../../src/core/harness/cost.js';
import type { CostWeights, InterceptedCall } from '../../../../src/types/harness.js';

describe('generateAlternatives', () => {
  test('generates outline alternative for large read', () => {
    const call: InterceptedCall = { tool: 'read', args: { file: 'big.ts' } };
    const alts = generateAlternatives(call, { fileTokens: 3000, mentionedSymbols: [] });
    expect(alts.some(a => a.tool === 'outline')).toBe(true);
  });
  test('generates focus alternative when symbols are mentioned', () => {
    const call: InterceptedCall = { tool: 'read', args: { file: 'big.ts' } };
    const alts = generateAlternatives(call, { fileTokens: 3000, mentionedSymbols: ['MyClass'] });
    expect(alts.some(a => a.tool === 'focus')).toBe(true);
  });
  test('generates budgeted read alternative', () => {
    const call: InterceptedCall = { tool: 'read', args: { file: 'big.ts' } };
    const alts = generateAlternatives(call, { fileTokens: 3000, mentionedSymbols: [] });
    expect(alts.some(a => a.tool === 'read' && a.args.maxTokens !== undefined)).toBe(true);
  });
});

describe('scoreCost', () => {
  test('scores with given weights', () => {
    const weights: CostWeights = { wTokens: 0.6, wLatency: 0.2, wCalls: 0.2 };
    const score = scoreCost({ estTokens: 1000, roundtrips: 1 }, weights);
    expect(score).toBeCloseTo(0.6 * 1000 + 0.2 * 1 + 0.2 * 1, 1);
  });
});

describe('evaluateCost', () => {
  test('rewrites when savings > 30%', () => {
    const call: InterceptedCall = { tool: 'read', args: { file: 'big.ts' } };
    const weights: CostWeights = { wTokens: 0.6, wLatency: 0.2, wCalls: 0.2 };
    const result = evaluateCost(call, weights, { fileTokens: 3000, mentionedSymbols: [] });
    expect(result.outcome).not.toBe('allow');
  });
  test('allows when no meaningful savings', () => {
    const call: InterceptedCall = { tool: 'read', args: { file: 'small.ts' } };
    const weights: CostWeights = { wTokens: 0.6, wLatency: 0.2, wCalls: 0.2 };
    const result = evaluateCost(call, weights, { fileTokens: 250, mentionedSymbols: [] });
    expect(result.outcome).toBe('allow');
  });
});
