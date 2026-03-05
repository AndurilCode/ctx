import { describe, expect, test } from 'bun:test';
import { classifyIntent, computeWeights, detectDrift } from '../../../../src/core/harness/classifier.js';
import type { SessionSignals } from '../../../../src/types/harness.js';

describe('classifyIntent', () => {
  test('fix/bug → targeted_fix', () => {
    expect(classifyIntent('fix the auth bug in login.ts').type).toBe('targeted_fix');
  });
  test('add/implement → feature', () => {
    expect(classifyIntent('add a dark mode toggle').type).toBe('feature');
  });
  test('rename/refactor → refactor', () => {
    expect(classifyIntent('rename getUserById to fetchUser').type).toBe('refactor');
  });
  test('how does/explain → exploration', () => {
    expect(classifyIntent('how does the auth system work?').type).toBe('exploration');
  });
  test('short what/where → pinpoint', () => {
    expect(classifyIntent('where is getUserById defined?').type).toBe('pinpoint');
  });
  test('test/verify → verification', () => {
    expect(classifyIntent('check if the tests pass').type).toBe('verification');
  });
  test('extracts focal files from prompt', () => {
    const result = classifyIntent('fix the bug in src/auth.ts');
    expect(result.focalFiles).toContain('src/auth.ts');
  });
  test('ambiguous prompt returns low confidence', () => {
    const result = classifyIntent('update the thing');
    expect(result.confidence).toBeLessThan(0.8);
  });
  test('classifies "what does this function do" as exploration, not pinpoint', () => {
    const result = classifyIntent('what does this function do');
    expect(result.type).toBe('exploration');
  });
  test('classifies "what is the entry point" as pinpoint', () => {
    const result = classifyIntent('what is the entry point');
    expect(result.type).toBe('pinpoint');
  });
  test('classifies "where is the config file" as pinpoint', () => {
    const result = classifyIntent('where is the config file');
    expect(result.type).toBe('pinpoint');
  });
});

describe('computeWeights', () => {
  const base: SessionSignals = {
    sequentialReads: 0, budgetConsumedPct: 0, depthEscalations: 0,
    uniqueFilesRead: 0, mutations: 0, sameFileRereads: 0, toolDiversity: 0,
  };
  test('targeted_fix base weights favor tokens', () => {
    const w = computeWeights('targeted_fix', base);
    expect(w.wTokens).toBeGreaterThan(w.wLatency);
    expect(w.wTokens).toBeGreaterThan(w.wCalls);
  });
  test('high budget pressure shifts toward tokens', () => {
    const w = computeWeights('feature', { ...base, budgetConsumedPct: 0.7 });
    const b = computeWeights('feature', base);
    expect(w.wTokens).toBeGreaterThan(b.wTokens);
  });
  test('many sequential reads shifts toward latency', () => {
    const w = computeWeights('targeted_fix', { ...base, sequentialReads: 5 });
    const b = computeWeights('targeted_fix', base);
    expect(w.wLatency).toBeGreaterThan(b.wLatency);
  });
  test('weights always sum to 1', () => {
    const w = computeWeights('exploration', { ...base, budgetConsumedPct: 0.8, sequentialReads: 10, depthEscalations: 5 });
    expect(w.wTokens + w.wLatency + w.wCalls).toBeCloseTo(1, 5);
  });
});

describe('detectDrift', () => {
  const base: SessionSignals = {
    sequentialReads: 0, budgetConsumedPct: 0, depthEscalations: 0,
    uniqueFilesRead: 0, mutations: 0, sameFileRereads: 0, toolDiversity: 0,
  };
  test('no drift when signals are normal', () => {
    expect(detectDrift('targeted_fix', base)).toBe('targeted_fix');
  });
  test('drift to exploration when reading many files without mutations', () => {
    expect(detectDrift('targeted_fix', { ...base, uniqueFilesRead: 10, toolDiversity: 6 })).toBe('exploration');
  });
  test('drift to verification after mutations', () => {
    expect(detectDrift('feature', { ...base, mutations: 3, uniqueFilesRead: 2 })).toBe('verification');
  });
});
