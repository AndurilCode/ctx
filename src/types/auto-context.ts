import type { ContextSourceResult } from './context.js';

export interface AutoContextOptions {
  query: string;
  maxTokens: number;
  path?: string;
  seeds?: string[];
  depth?: number;
  glob?: string;
  maxFiles?: number;
}

export interface SelectedFile {
  file: string;
  score: number;
  priority: 'high' | 'normal' | 'low';
}

export interface AutoContextResult {
  content: string;
  totalTokens: number;
  budget: number;
  query: string;
  sources: ContextSourceResult[];
  selectedFiles: SelectedFile[];
}
