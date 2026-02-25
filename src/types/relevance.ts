export interface RelevanceOptions {
  query: string;
  files: string[];
  maxResults?: number;
}

export interface RelevanceMatch {
  file: string;
  score: number;
  matches: string[];
}

export interface RelevanceResult {
  results: RelevanceMatch[];
}
