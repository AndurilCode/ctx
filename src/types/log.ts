export interface LogStripRule {
  type: 'strip';
  pattern: string;
}

export interface LogFoldRule {
  type: 'fold';
  pattern: string;
  label?: string;
}

export interface LogBlockRule {
  type: 'block';
  start: string;
  end: string;
  label?: string;
}

export type LogCustomRule = LogStripRule | LogFoldRule | LogBlockRule;
export type LogPruneProfile = 'test' | 'ci' | 'lint' | 'runtime';

export interface LogTokenCounter {
  count(input: string): number;
}

export interface LogPruneOptions {
  stripAnsi?: boolean;
  foldProgress?: boolean;
  stripTimestamps?: 'auto' | 'strip' | 'keep';
  elidePassingTests?: boolean;
  foldDebugLines?: boolean;
  elideHealthChecks?: boolean;
  foldJsonLines?: boolean;
  foldFrameworkStartup?: boolean;
  stripUserAgents?: boolean;
  dedupeStackTraces?: boolean;
  foldRepeatedLines?: boolean;
  foldGlobalRepeats?: boolean;
  collapseBlanks?: boolean;
  allowTokenExpansion?: boolean;
  thresholdTokens?: number;
  tokenCounter?: LogTokenCounter;
  customRules?: LogCustomRule[];
}

export interface LogPruneResult {
  output: string;
  originalTokens: number;
  prunedTokens: number;
  savingsPercent: number;
  appliedRules: string[];
  pruned: boolean;
  thresholdTokens?: number;
  overThreshold?: boolean;
}
