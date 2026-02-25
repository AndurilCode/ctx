import { describe, expect, test } from 'bun:test';
import { computeStageStats, computeStats } from '../../../src/utils/stats.js';

describe('computeStageStats', () => {
  test('computes byte savings per stage', () => {
    const results = computeStageStats([{ stage: 'whitespace', before: 'hello   ', after: 'hello' }]);
    expect(results).toHaveLength(1);
    const stat = results[0]!;
    expect(stat.stage).toBe('whitespace');
    expect(stat.beforeBytes).toBe(8);
    expect(stat.afterBytes).toBe(5);
    expect(stat.savingsBytes).toBe(3);
    expect(stat.savingsPercent).toBeCloseTo(37.5);
  });

  test('handles empty stages array', () => {
    expect(computeStageStats([])).toEqual([]);
  });

  test('sets savingsPercent to 0 when before is empty', () => {
    const results = computeStageStats([{ stage: 's', before: '', after: '' }]);
    expect(results[0]!.savingsPercent).toBe(0);
  });
});

describe('computeStats', () => {
  test('computes overall bytes and token savings', () => {
    const stats = computeStats('hello world', 'hello');
    expect(stats.originalBytes).toBe(11);
    expect(stats.compactBytes).toBe(5);
    expect(stats.savingsBytes).toBe(6);
    expect(stats.savingsPercent).toBeCloseTo(54.5, 0);
  });

  test('accepts custom token counter', () => {
    const counter = { count: (s: string) => s.split(' ').length };
    const stats = computeStats('hello world', 'hello', [], counter);
    expect(stats.originalTokens).toBe(2);
    expect(stats.compactTokens).toBe(1);
  });

  test('sets savingsPercent to 0 when original is empty', () => {
    const stats = computeStats('', '');
    expect(stats.savingsPercent).toBe(0);
  });

  test('includes stageStats in output', () => {
    const stageStats = [
      { stage: 'ws', beforeBytes: 10, afterBytes: 8, savingsBytes: 2, savingsPercent: 20 },
    ];
    const stats = computeStats('hello', 'hello', stageStats);
    expect(stats.stageStats).toEqual(stageStats);
  });
});
