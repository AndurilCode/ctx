export interface TreeOptions {
  path?: string;
  glob?: string;
  depth?: number;
  ignore?: string[];
  concurrency?: number;
}

export interface TreeEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  tokens?: number;
  bytes?: number;
  lines?: number;
  children?: TreeEntry[];
}

export interface TreeResult {
  root: string;
  entries: TreeEntry[];
  totalTokens: number;
  totalFiles: number;
  output: string;
}
