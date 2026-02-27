export interface ReviewOptions {
  query: string;
  path?: string;
  glob?: string;
  profile?: 'code' | 'full' | 'docs';
  maxResults?: number;
  pass1Tokens?: number;
  pass2Tokens?: number;
  maxPass2Files?: number;
  riskTerms?: string[];
  evidence?: boolean;
  changedFiles?: string[];  // absolute or relative paths to boost
  diffBase?: string;        // git ref to derive changedFiles from (e.g. 'HEAD~1', 'main')
  cluster?: boolean;
}

export interface EvidenceLine {
  lineNumber: number; // 1-indexed
  content: string;
  matchedTerm: string;
}

export interface ReviewFileResult {
  file: string;
  score: number;
  fullTokens: number;
  pass1Tokens: number;
  pass1Strategy: string;
  flagged: boolean;
  matchedRiskTerms: string[];
  pass2Tokens: number;
  pass2Strategy?: string;
  evidence?: EvidenceLine[];
}

export interface ReviewTotals {
  fullTokens: number;
  pass1Tokens: number;
  pass2Tokens: number;
  pass2Files: number;
  twoPassTokens: number;
  savedTokens: number;
  reductionPercent: number;
}

export interface ReviewCluster {
  term: string;
  files: string[];
  count: number;
}

export interface ReviewResult {
  query: string;
  root: string;
  glob: string;
  files: ReviewFileResult[];
  totals: ReviewTotals;
  clusters?: ReviewCluster[];
}
