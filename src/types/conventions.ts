export interface ConventionSignal {
  key: 'errors' | 'returns' | 'naming' | 'imports' | 'style' | 'exports' | 'tests';
  detail: string;
  confidence: number;
}

export interface ConventionsOptions {
  directory: string;
  maxFiles?: number;
  threshold?: number;
}

export interface ConventionsResult {
  directory: string;
  sampledFiles: number;
  signals: ConventionSignal[];
  output: string;
}
