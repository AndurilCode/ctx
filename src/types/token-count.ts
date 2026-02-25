export interface TokenCountOptions {
  text?: string;
  file?: string;
}

export interface TokenCountResult {
  tokens: number;
  bytes: number;
  lines: number;
}
