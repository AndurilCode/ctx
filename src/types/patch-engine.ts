export interface SymbolLocation {
  name: string;
  hash: string;
  startLine: number;
  endLine: number;
  startIndex: number; // byte offset in source
  endIndex: number; // byte offset in source
  ambiguous?: Array<{ name: string; hash: string; startLine: number; endLine: number }>;
}

export interface LineHash {
  hash: string;
  line: string;
  lineNumber: number; // 1-based
}
