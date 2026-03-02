export interface ChangedSymbol {
  file: string;
  symbol: string;
  hashBefore?: string;
  hashAfter?: string;
}

export interface VerifyChangesOptions {
  file?: string;
  symbol?: string;
  since?: string;
  diff?: boolean;
  exec?: boolean;
  testCommand?: string;
  typeCommand?: string;
  maxTokens?: number;
  timeoutMs?: number;
  root?: string;
}

export interface VerifyCommandResult {
  command: string;
  passed: boolean;
  timedOut: boolean;
  exitCode: number;
  output: string;
}

export interface VerifyChangesResult {
  mode: 'plan' | 'exec';
  files: string[];
  changedSymbols: ChangedSymbol[];
  callers: Record<string, string[]>;
  typeCommand?: string;
  testCommand?: string;
  testTargets: string[];
  plan: string[];
  typeCheck?: VerifyCommandResult;
  tests?: VerifyCommandResult;
  verdict: string;
  output: string;
}
