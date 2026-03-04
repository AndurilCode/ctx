import type {
  TaskType,
  CostWeights,
  SessionSignals,
  StrategyProfile,
} from '../../types/harness.js';

// ── Intent patterns (first high-confidence match wins) ──────────────

interface IntentPattern {
  pattern: RegExp;
  type: TaskType;
  confidence: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  { pattern: /^(what|where)\b.{0,50}$/i, type: 'pinpoint', confidence: 0.7 },
  { pattern: /\b(fix|bug|error|crash|broken|failing)\b/i, type: 'targeted_fix', confidence: 0.8 },
  { pattern: /\b(add|implement|create|build|new)\b/i, type: 'feature', confidence: 0.7 },
  { pattern: /\b(rename|move|extract|refactor|split|merge)\b/i, type: 'refactor', confidence: 0.8 },
  { pattern: /\b(what|how|why|explain|understand)\b/i, type: 'exploration', confidence: 0.6 },
  { pattern: /\b(test|check|verify|does it work)\b/i, type: 'verification', confidence: 0.7 },
];

const FILE_PATH_RE = /(?:^|\s)((?:[\w.-]+\/)*[\w.-]+\.[a-z]{1,5})(?:\s|$|:|\b)/gi;

export interface ClassifyResult {
  type: TaskType;
  confidence: number;
  focalFiles: string[];
}

/**
 * Match a prompt against intent patterns to determine task type.
 * Extracts file paths from the prompt text.
 */
export function classifyIntent(prompt: string): ClassifyResult {
  const focalFiles = extractFiles(prompt);

  for (const { pattern, type, confidence } of INTENT_PATTERNS) {
    if (pattern.test(prompt)) {
      return { type, confidence, focalFiles };
    }
  }

  return { type: 'exploration', confidence: 0.3, focalFiles };
}

function extractFiles(prompt: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex before use since the regex has the 'g' flag
  FILE_PATH_RE.lastIndex = 0;
  while ((m = FILE_PATH_RE.exec(prompt)) !== null) {
    if (m[1]) matches.push(m[1]);
  }
  return matches;
}

// ── Base weights per task type ──────────────────────────────────────

const BASE_WEIGHTS: Record<TaskType, CostWeights> = {
  pinpoint:      { wTokens: 0.2,  wLatency: 0.6,  wCalls: 0.2  },
  targeted_fix:  { wTokens: 0.6,  wLatency: 0.2,  wCalls: 0.2  },
  feature:       { wTokens: 0.35, wLatency: 0.3,  wCalls: 0.35 },
  refactor:      { wTokens: 0.2,  wLatency: 0.2,  wCalls: 0.6  },
  exploration:   { wTokens: 0.4,  wLatency: 0.3,  wCalls: 0.3  },
  verification:  { wTokens: 0.3,  wLatency: 0.5,  wCalls: 0.2  },
};

/**
 * Compute cost weights from base weights for a task type, adjusted by
 * live session signals. Weights are clamped (min 0.05) and normalized
 * so they sum to 1.
 */
export function computeWeights(taskType: TaskType, signals: SessionSignals): CostWeights {
  let { wTokens, wLatency, wCalls } = { ...BASE_WEIGHTS[taskType] };

  // Sequential reads adjustment
  if (signals.sequentialReads > 3) {
    wLatency += 0.15;
    wTokens  -= 0.1;
    wCalls   -= 0.05;
  }

  // Budget pressure adjustment
  if (signals.budgetConsumedPct > 0.6) {
    wTokens  += 0.2;
    wLatency -= 0.1;
    wCalls   -= 0.1;
  }

  // Depth escalation adjustment
  if (signals.depthEscalations > 2) {
    wTokens  -= 0.15;
    wLatency += 0.1;
    wCalls   += 0.05;
  }

  // Clamp negatives to 0.05
  wTokens  = Math.max(wTokens,  0.05);
  wLatency = Math.max(wLatency, 0.05);
  wCalls   = Math.max(wCalls,   0.05);

  // Normalize to sum=1
  const sum = wTokens + wLatency + wCalls;
  wTokens  /= sum;
  wLatency /= sum;
  wCalls   /= sum;

  return { wTokens, wLatency, wCalls };
}

// ── Drift detection ─────────────────────────────────────────────────

/**
 * Detect when actual session behavior diverges from the initial
 * classification. Returns the corrected task type, or the original
 * if no drift is detected.
 */
export function detectDrift(classified: TaskType, signals: SessionSignals): TaskType {
  // Drift to verification: mutations >= 2 and not already verification/refactor
  if (
    signals.mutations > 0 &&
    signals.mutations >= 2 &&
    classified !== 'verification' &&
    classified !== 'refactor'
  ) {
    return 'verification';
  }

  // Drift to exploration: composite score > 0.5
  let score = 0;
  if (signals.uniqueFilesRead > 8)  score += 0.3;
  if (signals.depthEscalations > 3) score += 0.2;
  if (signals.mutations === 0 && signals.uniqueFilesRead > 5) score += 0.3;
  if (signals.toolDiversity > 5)    score += 0.2;

  if (score > 0.5) {
    return 'exploration';
  }

  return classified;
}

// ── Profile builder ─────────────────────────────────────────────────

/**
 * Compose classifyIntent + detectDrift + computeWeights into a
 * single StrategyProfile.
 */
export function buildProfile(prompt: string, signals: SessionSignals): StrategyProfile {
  const { type, focalFiles } = classifyIntent(prompt);
  const corrected = detectDrift(type, signals);
  const weights = computeWeights(corrected, signals);

  return { type: corrected, weights, focalFiles };
}
