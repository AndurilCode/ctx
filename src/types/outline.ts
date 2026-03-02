export type OutlineNodeKind =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'import'
  | 'export';

export interface OutlineNode {
  kind: OutlineNodeKind;
  name: string;
  signature?: string;
  hash?: string;
  startLine: number;
  endLine: number;
  children?: OutlineNode[];
}

export interface OutlineOptions {
  language?: string;
  filePath?: string;
  depth?: number;
  collapseImports?: boolean;
}

export interface OutlineResult {
  nodes: OutlineNode[];
  language: string;
  totalLines: number;
  output: string;
}
