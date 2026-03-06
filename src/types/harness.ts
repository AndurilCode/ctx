// --- Task Classification ---
export type TaskType = 'pinpoint' | 'targeted_fix' | 'feature' | 'refactor' | 'exploration' | 'verification';

export interface StrategyProfile {
  type: TaskType;
  weights: CostWeights;
  focalFiles: string[];
}

export interface CostWeights {
  wTokens: number;
  wLatency: number;
  wCalls: number;
}

// --- Budget ---
export interface BudgetZones {
  system: number;
  starter: number;
  working: number;
  output: number;
  safety: number;
}

export interface BudgetState {
  total: number;
  allocated: BudgetZones;
  consumed: BudgetZones;
}

// --- Cache ---
export interface CachedRead {
  strategy: string;
  tokens: number;
  turn: number;
  content?: string;
}

export interface SessionCache {
  filesRead: Map<string, CachedRead>;
  symbolsSeen: Set<string>;
  rankResults: Map<string, string[]>;
  hotFiles: Set<string>;
}

// --- History ---
export interface ToolCallRecord {
  turn: number;
  tool: string;
  args: Record<string, unknown>;
  tokensConsumed: number;
  durationMs: number;
}

// --- Session Signals ---
export interface SessionSignals {
  sequentialReads: number;
  currentReadStreak: number;
  budgetConsumedPct: number;
  depthEscalations: number;
  uniqueFilesRead: number;
  mutations: number;
  sameFileRereads: number;
  toolDiversity: number;
}

// --- Decision Engine ---

export interface BudgetContext {
  savedTokens: number;
  savedPct: number;
  remainingBudget: number;
  pressureLevel: 'low' | 'medium' | 'high';
}
export interface InterceptedCall {
  tool: string;
  args: Record<string, unknown>;
}

export type DecisionAction =
  | { action: 'allow' }
  | { action: 'rewrite'; tool: string; args: Record<string, unknown>; budgetContext?: BudgetContext }
  | { action: 'inject_before'; calls: InterceptedCall[] }
  | { action: 'return_cached'; result: unknown }
  | { action: 'warn'; message: string }
  | { action: 'deny'; reason: string };

export type StageResult =
  | { outcome: 'allow' }
  | { outcome: 'rewrite'; tool: string; args: Record<string, unknown>; budgetContext?: BudgetContext }
  | { outcome: 'escalate'; hint?: string; alternatives?: ScoredAlternative[]; budgetContext?: BudgetContext }
  | { outcome: 'return_cached'; file: string; cached: CachedRead }
  | { outcome: 'deny'; reason: string };

export interface ScoredAlternative {
  tool: string;
  args: Record<string, unknown>;
  estTokens: number;
  roundtrips: number;
  cost: number;
}

// --- Rewrite Feedback ---
export interface PendingRewrite {
  turn: number;
  suggestedTool: string;
  suggestedArgs: Record<string, unknown>;
}

// --- Session State (top-level) ---

// --- Downgrade Tracking (Phase 2) ---
export interface DowngradeEvent {
  ts: number;
  surface: Surface;
  intended: DecisionAction['action'];
  actual: RuntimeResult['action'];
  reason: string;
}

export interface DowngradeCounters {
  rewriteToContext: number;
  returnCachedToDeny: number;
  total: number;
}
export interface HarnessState {
  profile: StrategyProfile;
  budget: BudgetState;
  cache: SessionCache;
  history: ToolCallRecord[];
  signals: SessionSignals;
  turn: number;
  pendingRewrite?: PendingRewrite;
  rewriteCompliance: { followed: number; ignored: number };
  downgrades: DowngradeCounters;
}

// --- Serializable subset for disk persistence ---
export interface SerializedHarnessState {
  profile: StrategyProfile;
  budget: BudgetState;
  cache: {
    filesRead: Record<string, CachedRead>;
    symbolsSeen: string[];
    rankResults: Record<string, string[]>;
    hotFiles: string[];
  };
  history: ToolCallRecord[];
  signals: SessionSignals;
  turn: number;
  pendingRewrite?: PendingRewrite;
  rewriteCompliance: { followed: number; ignored: number };
  downgrades?: DowngradeCounters;
}

// --- Context Kernel Runtime (Phase 1) ---

export type ToolClass =
  | 'read'
  | 'search'
  | 'list'
  | 'mutate'
  | 'execute'
  | 'verify'
  | 'context';

export type Surface = 'claude-hook' | 'vscode-hook' | 'mcp' | 'cli' | 'library';

export interface AdapterCapabilities {
  canBlock: boolean;
  canRewrite: boolean;
  canInjectContext: boolean;
  canReturnCached: boolean;
}

export interface HarnessRequest {
  surface: Surface;
  event: string;
  toolClass: ToolClass;
  toolName: string;
  args: Record<string, unknown>;
  rawPath?: string;
  prompt?: string;
  taskDescription?: string;
  capabilities: AdapterCapabilities;
}

export type RuntimeResult =
  | { action: 'allow' }
  | { action: 'deny'; output: { type: 'block'; value: string } }
  | { action: 'rewrite'; output: { type: 'context'; value: string } | { type: 'execute'; tool: string; args: Record<string, unknown> } }
  | { action: 'return_cached'; output: { type: 'result'; file: string; cached: CachedRead } }
  | { action: 'warn'; output: { type: 'context'; value: string } }
  | { action: 'noop' };
