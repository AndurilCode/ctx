import { describe, expect, test } from 'bun:test';
import type { DecisionAction, StageResult, StrategyProfile, ToolClass, Surface, AdapterCapabilities, HarnessRequest, RuntimeResult } from '../../../../src/types/harness.js';

describe('harness types', () => {
  test('StrategyProfile is constructable', () => {
    const profile: StrategyProfile = {
      type: 'targeted_fix',
      weights: { wTokens: 0.6, wLatency: 0.2, wCalls: 0.2 },
      focalFiles: ['src/auth.ts'],
    };
    expect(profile.type).toBe('targeted_fix');
  });

  test('DecisionAction discriminated union', () => {
    const allow: DecisionAction = { action: 'allow' };
    const rewrite: DecisionAction = { action: 'rewrite', tool: 'outline', args: { file: 'x.ts' } };
    expect(allow.action).toBe('allow');
    expect(rewrite.action).toBe('rewrite');
  });

  test('DecisionAction supports deny with reason', () => {
    const action: DecisionAction = { action: 'deny', reason: 'Already read this file' };
    expect(action.action).toBe('deny');
    expect(action.reason).toBe('Already read this file');
  });



  test("BudgetContext on StageResult rewrite variant", () => {
    const result: StageResult = {
      outcome: "rewrite",
      tool: "outline",
      args: { file: "big.ts" },
      budgetContext: {
        savedTokens: 1200,
        savedPct: 0.62,
        remainingBudget: 15000,
        pressureLevel: "medium",
      },
    };
    expect(result.outcome).toBe("rewrite");
    if (result.outcome === "rewrite") {
      expect(result.budgetContext).toBeDefined();
      expect(result.budgetContext!.savedTokens).toBe(1200);
      expect(result.budgetContext!.pressureLevel).toBe("medium");
    }
  });

  test("BudgetContext on StageResult escalate variant", () => {
    const result: StageResult = {
      outcome: "escalate",
      hint: "large_file_no_budget",
      budgetContext: {
        savedTokens: 0,
        savedPct: 0,
        remainingBudget: 5000,
        pressureLevel: "high",
      },
    };
    expect(result.outcome).toBe("escalate");
    if (result.outcome === "escalate") {
      expect(result.budgetContext).toBeDefined();
      expect(result.budgetContext!.pressureLevel).toBe("high");
    }
  });

  test("BudgetContext on DecisionAction rewrite variant", () => {
    const rewriteAction: DecisionAction = {
      action: "rewrite",
      tool: "outline",
      args: { file: "big.ts" },
      budgetContext: {
        savedTokens: 800,
        savedPct: 0.45,
        remainingBudget: 20000,
        pressureLevel: "low",
      },
    };
    expect(rewriteAction.action).toBe("rewrite");
    if (rewriteAction.action === "rewrite") {
      expect(rewriteAction.budgetContext).toBeDefined();
      expect(rewriteAction.budgetContext!.savedTokens).toBe(800);
    }
  });

  test('ToolClass covers expected categories', () => {
    const classes: ToolClass[] = ['read', 'search', 'list', 'mutate', 'execute', 'verify', 'context'];
    expect(classes).toHaveLength(7);
  });

  test('RuntimeResult covers all decision actions', () => {
    const allow: RuntimeResult = { action: 'allow' };
    const deny: RuntimeResult = { action: 'deny', output: { type: 'block', value: 'reason' } };
    const rewrite: RuntimeResult = { action: 'rewrite', output: { type: 'context', value: 'msg' } };
    const warn: RuntimeResult = { action: 'warn', output: { type: 'context', value: 'msg' } };
    const noop: RuntimeResult = { action: 'noop' };
    expect([allow, deny, rewrite, warn, noop]).toHaveLength(5);
  });
});
