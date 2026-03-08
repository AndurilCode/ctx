export interface ExecOptions {
  code: string;
  cwd?: string;
  timeout?: number;
  maxOutputTokens?: number;
  allowWrite?: boolean;
}

export interface ExecResult {
  success: boolean;
  output: string;
  result?: unknown;
  error?: { name: string; message: string; stack?: string };
  tokensUsed: number;
  durationMs: number;
  truncated: boolean;
}
