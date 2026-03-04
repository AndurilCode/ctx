import { describe, expect, test } from 'bun:test';
import type { HarnessState, DecisionAction, StrategyProfile } from '../../../../src/types/harness.js';

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
});
