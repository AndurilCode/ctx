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
  budgetConsumedPct: number;
  depthEscalations: number;
  uniqueFilesRead: number;
  mutations: number;
  sameFileRereads: number;
  toolDiversity: number;
}

// --- Decision Engine ---
export interface InterceptedCall {
  tool: string;
  args: Record<string, unknown>;
}

export type DecisionAction =
  | { action: 'allow' }
  | { action: 'rewrite'; tool: string; args: Record<string, unknown> }
  | { action: 'inject_before'; calls: InterceptedCall[] }
  | { action: 'return_cached'; result: unknown }
  | { action: 'warn'; message: string };

export type StageResult =
  | { outcome: 'allow' }
  | { outcome: 'rewrite'; tool: string; args: Record<string, unknown> }
  | { outcome: 'escalate'; hint?: string; alternatives?: ScoredAlternative[] };

export interface ScoredAlternative {
  tool: string;
  args: Record<string, unknown>;
  estTokens: number;
  roundtrips: number;
  cost: number;
}

// --- Session State (top-level) ---
export interface HarnessState {
  profile: StrategyProfile;
  budget: BudgetState;
  cache: SessionCache;
  history: ToolCallRecord[];
  signals: SessionSignals;
  turn: number;
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
}
