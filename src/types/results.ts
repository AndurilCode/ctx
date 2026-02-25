export interface StageStats {
  stage: string;
  beforeBytes: number;
  afterBytes: number;
  savingsBytes: number;
  savingsPercent: number;
}

export interface Stats {
  originalBytes: number;
  compactBytes: number;
  originalTokens: number;
  compactTokens: number;
  savingsBytes: number;
  savingsPercent: number;
  stageStats: StageStats[];
}

export interface CompactResult {
  output: string;
  stats?: Stats;
}

declare module 'mdast' {
  interface RootData {
    order?: string[];
  }
}
