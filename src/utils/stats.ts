import type { StageStats, Stats } from '../types/results.js';
import { type TokenCounter, createFallbackTokenCounter } from './tokens.js';

export interface StageMeasurement {
  stage: string;
  before: string;
  after: string;
}

export function computeStageStats(stages: readonly StageMeasurement[]): StageStats[] {
  return stages.map((measurement) => {
    const beforeBytes = Buffer.byteLength(measurement.before, 'utf8');
    const afterBytes = Buffer.byteLength(measurement.after, 'utf8');
    const savingsBytes = beforeBytes - afterBytes;
    const savingsPercent = beforeBytes === 0 ? 0 : (savingsBytes / beforeBytes) * 100;

    return {
      stage: measurement.stage,
      beforeBytes,
      afterBytes,
      savingsBytes,
      savingsPercent,
    };
  });
}

export function computeStats(
  original: string,
  compacted: string,
  stageStats: readonly StageStats[] = [],
  tokenCounter: TokenCounter = createFallbackTokenCounter(),
): Stats {
  const originalBytes = Buffer.byteLength(original, 'utf8');
  const compactBytes = Buffer.byteLength(compacted, 'utf8');
  const savingsBytes = originalBytes - compactBytes;
  const savingsPercent = originalBytes === 0 ? 0 : (savingsBytes / originalBytes) * 100;

  return {
    originalBytes,
    compactBytes,
    originalTokens: tokenCounter.count(original),
    compactTokens: tokenCounter.count(compacted),
    savingsBytes,
    savingsPercent,
    stageStats: [...stageStats],
  };
}
