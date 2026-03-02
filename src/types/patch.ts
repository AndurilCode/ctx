export interface PatchLineEdit {
  hash: string;
  replace?: string;
  after?: string;
  before?: string;
  delete?: boolean;
}

export interface SinglePatchOp {
  symbol: string;
  hash: string;
  body?: string;
  lines?: PatchLineEdit[];
  imports?: string[];
}

export interface PatchInput {
  file: string;
  symbol?: string;
  hash?: string;
  body?: string;
  lines?: PatchLineEdit[];
  imports?: string[];
  patches?: SinglePatchOp[];
  language?: string;
  dryRun?: boolean;
}

export interface InsertInput {
  file: string;
  position: string;
  anchor_hash?: string;
  body: string;
  imports?: string[];
  dryRun?: boolean;
}

export interface RenameInput {
  file: string;
  symbol: string;
  hash: string;
  to: string;
  scope?: string;
  dryRun?: boolean;
}

export type PatchErrorCode = 'STALE_READ' | 'SYMBOL_NOT_FOUND' | 'PARSE_ERROR' | 'AMBIGUOUS_SYMBOL';

export interface PatchError {
  code: PatchErrorCode;
  message: string;
  freshOutline?: string;
  disambiguation?: Array<{ name: string; hash: string; startLine: number; endLine: number }>;
}

export interface PatchSuccess {
  ok: true;
  diff: string;
  linesChanged: number;
  updatedOutline?: string;
}

export interface PatchFailure {
  ok: false;
  error: PatchError;
}

export type PatchResult = PatchSuccess | PatchFailure;

export interface RenameSuccess {
  ok: true;
  filesChanged: number;
  referencesUpdated: number;
  summary: string;
}

export type RenameResult = RenameSuccess | PatchFailure;
