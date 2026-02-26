export type ReadStrategy = 'auto' | 'truncate' | 'outline' | 'sections' | 'summarize';

export interface ReadOptions {
  file: string;
  maxTokens?: number;
  strategy?: ReadStrategy;
  content?: string;
  totalTokens?: number;
}

export interface ReadResult {
  content: string;
  strategy: ReadStrategy | 'full';
  totalTokens: number;
  returnedTokens: number;
  truncated: boolean;
}
