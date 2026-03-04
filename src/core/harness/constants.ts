import type { BudgetZones, StrategyProfile } from '../../types/harness.js';

export const MUTATION_TOOLS = new Set([
  'edit', 'write', 'patch', 'insert', 'rename', 'bash',
]);

export const READ_TOOLS = new Set([
  'read', 'grep', 'glob', 'gather', 'outline', 'focus', 'rank', 'context',
]);

export const DEFAULT_PROFILE: StrategyProfile = {
  type: 'exploration',
  weights: { wTokens: 0.4, wLatency: 0.3, wCalls: 0.3 },
  focalFiles: [],
};

/** Budget zone percentages — must sum to 1.0 */
export const ZONE_PCT: Record<keyof BudgetZones, number> = {
  system: 0.15,
  starter: 0.25,
  working: 0.40,
  output: 0.15,
  safety: 0.05,
};
