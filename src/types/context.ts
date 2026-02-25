import type { ReadStrategy } from './read.js';

export interface ContextSource {
  file: string;
  sections?: string[];
  priority?: 'high' | 'normal' | 'low';
}

export interface ContextOptions {
  sources: ContextSource[];
  maxTokens: number;
  strategy?: ReadStrategy;
}

export interface ContextSourceResult {
  file: string;
  strategy: string;
  tokens: number;
}

export interface ContextResult {
  content: string;
  totalTokens: number;
  budget: number;
  sources: ContextSourceResult[];
}
