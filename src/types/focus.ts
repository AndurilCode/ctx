import type { ConventionSignal } from './conventions.js';
import type { SymbolDefinition, SymbolUsage } from './symbols.js';

export type FocusSection = 'body' | 'callers' | 'deps' | 'types' | 'tests' | 'conventions';

export interface FocusOptions {
  file: string;
  symbol: string;
  hash?: string;
  maxTokens?: number;
  depth?: number;
  include?: FocusSection[];
  root?: string;
}

export interface FocusDependency {
  name: string;
  definition?: SymbolDefinition;
}

export interface FocusTypeRef {
  name: string;
  definition?: SymbolDefinition;
}

export interface FocusTestReference {
  file: string;
  usages: SymbolUsage[];
}

export interface FocusResult {
  file: string;
  symbol: string;
  hash?: string;
  kind?: string;
  range?: { startLine: number; endLine: number };
  sections: FocusSection[];
  body?: string;
  callers?: SymbolUsage[];
  dependencies?: FocusDependency[];
  types?: FocusTypeRef[];
  tests?: FocusTestReference[];
  conventions?: ConventionSignal[];
  output: string;
}
