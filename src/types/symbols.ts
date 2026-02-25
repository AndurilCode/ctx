import type { OutlineNodeKind } from './outline.js';

export interface SymbolsOptions {
  query: string;
  path?: string;
  glob?: string;
  kind?: OutlineNodeKind;
}

export interface SymbolDefinition {
  file: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
}

export interface SymbolUsage {
  file: string;
  line: number;
  context: string;
}

export interface SymbolsResult {
  query: string;
  definitions: SymbolDefinition[];
  usages: SymbolUsage[];
  output: string;
}
