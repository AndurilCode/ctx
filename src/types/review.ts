export interface ReviewOptions {
  query: string;
  path?: string;
  glob?: string;
  maxResults?: number;
  pass1Tokens?: number;
  pass2Tokens?: number;
  maxPass2Files?: number;
  riskTerms?: string[];
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

export interface ReviewResult {
  query: string;
  root: string;
  glob: string;
  files: ReviewFileResult[];
  totals: ReviewTotals;
}
