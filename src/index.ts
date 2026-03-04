export { compact } from './core/compact.js';
export { tokenCount } from './core/token-count.js';
export type { TokenCountOptions, TokenCountResult } from './types/token-count.js';
export { compactDiff } from './core/compact-diff.js';
export { codeOutline } from './core/code-outline.js';
export { createPipeline } from './core/create-pipeline.js';
export { expand } from './core/expand.js';
export { pruneLog } from './core/prune-log.js';
export { verifyChanges } from './core/change-verify.js';
export { conventions } from './core/conventions.js';
export { focus } from './core/focus.js';
export { verify } from './core/verify.js';
export {
  verifyRoundTrip,
  verifyRoundTripWithDiagnostics,
  type VerifyRoundTripDiagnostics,
} from './core/roundtrip-verify.js';

export type { CompactOptions, ExpandOptions } from './types/options.js';
export type { DiffCompactOptions } from './types/diff.js';
export type {
  OutlineNode,
  OutlineNodeKind,
  OutlineOptions,
  OutlineResult,
} from './types/outline.js';
export type {
  LogCustomRule,
  LogPruneOptions,
  LogPruneProfile,
  LogPruneResult,
  LogTokenCounter,
} from './types/log.js';
export type { CompactResult, StageStats, Stats } from './types/results.js';
export type { VerifyChangesOptions, VerifyChangesResult } from './types/change-verify.js';
export type {
  FocusDependency,
  FocusOptions,
  FocusResult,
  FocusSection,
  FocusTestReference,
  FocusTypeRef,
} from './types/focus.js';
export type { ConventionSignal, ConventionsOptions, ConventionsResult } from './types/conventions.js';
export { tree } from './core/tree.js';
export type { TreeOptions, TreeResult } from './types/tree.js';
export { budgetedRead } from './core/read.js';
export type { ReadOptions, ReadResult, ReadStrategy } from './types/read.js';
export { assembleContext } from './core/context.js';
export type {
  ContextOptions,
  ContextResult,
  ContextSource,
  ContextSourceResult,
} from './types/context.js';
export { autoContext } from './core/auto-context.js';
export type { AutoContextOptions, AutoContextResult, SelectedFile } from './types/auto-context.js';
export { relevance } from './core/relevance.js';
export type { RelevanceMatch, RelevanceOptions, RelevanceResult } from './types/relevance.js';
export { review } from './core/review.js';
export type {
  ReviewFileResult,
  ReviewOptions,
  ReviewResult,
  ReviewTotals,
} from './types/review.js';
export { fileImports } from './core/imports.js';
export type { ImportEdge, ImportsOptions, ImportsResult } from './types/imports.js';
export { symbols } from './core/symbols.js';
export type {
  SymbolDefinition,
  SymbolsOptions,
  SymbolsResult,
  SymbolUsage,
} from './types/symbols.js';
export { patch } from './core/patch.js';
export { insert } from './core/insert.js';
export { rename } from './core/rename.js';
export type {
  PatchInput,
  PatchResult,
  PatchSuccess,
  PatchFailure,
  PatchError,
  PatchErrorCode,
  InsertInput,
  RenameInput,
  RenameResult,
  SinglePatchOp,
  PatchLineEdit,
} from './types/patch.js';
export type {
  TaskType,
  StrategyProfile,
  CostWeights,
  BudgetZones,
  BudgetState,
  CachedRead,
  SessionCache,
  ToolCallRecord,
  SessionSignals,
  InterceptedCall,
  DecisionAction,
  StageResult,
  ScoredAlternative,
  HarnessState,
  SerializedHarnessState,
} from './types/harness.js';
export {
  createHarnessState,
  recordToolCall,
  updateSignals,
} from './core/harness/state.js';
export { serialize, deserialize } from './core/harness/serialize.js';
export { classifyIntent, computeWeights, detectDrift, buildProfile } from './core/harness/classifier.js';
export { evaluateRules } from './core/harness/rules.js';
export { generateAlternatives, scoreCost, evaluateCost } from './core/harness/cost.js';
export { buildJudgePrompt, parseJudgeResponse, evaluateWithJudge } from './core/harness/judge.js';
export { decide } from './core/harness/pipeline.js';
export { computeMetrics } from './core/harness/metrics.js';
export type { SessionMetrics } from './core/harness/metrics.js';
