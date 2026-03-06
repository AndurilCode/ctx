import type { HarnessRequest, RuntimeResult } from '../../types/harness.js';
import { recordToolCall } from './state.js';
import { loadState, saveState, resetState } from './store.js';
import { decide } from './pipeline.js';
import { buildProfile } from './classifier.js';
import { computeMetrics } from './metrics.js';
import { appendFileSync, statSync } from 'node:fs';
import type { PipelineOptions } from './pipeline.js';
import { appendEntry } from './journal.js';

export interface RuntimeOptions {
  statePath: string;
  metricsPath?: string;
  contextWindow?: number;
  pipelineOptions?: PipelineOptions;
}

const HARNESS_TOOLS = new Set(['Read', 'Grep', 'Glob']);


function emitDowngrade(
  opts: RuntimeOptions,
  request: HarnessRequest,
  intended: string,
  actual: string,
  reason: string,
): void {
  if (!opts.metricsPath) return;
  const journalPath = opts.metricsPath.replace(/\.jsonl?$/, '-journal.jsonl');
  try {
    appendEntry(journalPath, {
      ts: Date.now(),
      event: 'downgrade',
      data: { surface: request.surface, intended, actual, reason },
    });
  } catch { /* best-effort */ }
}

export async function evaluate(
  request: HarnessRequest,
  opts: RuntimeOptions,
): Promise<RuntimeResult> {
  const { statePath, contextWindow = 200_000 } = opts;

  // --- SessionStart / PreCompact: reset ---
  if (request.event === 'SessionStart' || request.event === 'PreCompact') {
    resetState(statePath);
    return { action: 'noop' };
  }

  // --- UserPromptSubmit: classify intent ---
  if (request.event === 'UserPromptSubmit' && request.prompt) {
    try {
      const state = loadState(statePath, contextWindow);
      const profile = buildProfile(request.prompt, state.signals);
      state.profile = profile;
      saveState(statePath, state);
    } catch { /* harness not available */ }
    return { action: 'noop' };
  }

  // --- Stop: emit metrics ---
  if (request.event === 'Stop') {
    try {
      const state = loadState(statePath, contextWindow);
      const metrics = computeMetrics(state);
      const metricsPath = opts.metricsPath;
      if (metricsPath) {
        appendFileSync(metricsPath, JSON.stringify({
          timestamp: new Date().toISOString(),
          taskType: state.profile.type,
          ...metrics,
        }) + '\n');
      }
    } catch { /* harness not available or no state */ }
    return { action: 'noop' };
  }

  // --- Only mediate PreToolUse ---
  if (request.event !== 'PreToolUse') return { action: 'noop' };

  // --- Only mediate read/search/list tools ---
  if (!HARNESS_TOOLS.has(request.toolName)) return { action: 'noop' };

  const state = loadState(statePath, contextWindow);

  const fileTokens = new Map<string, number>();
  if (request.rawPath) {
    try {
      const stat = statSync(request.rawPath);
      fileTokens.set(request.rawPath, Math.ceil(stat.size / 4));
    } catch { /* file may not exist */ }
  }

  const decision = await decide(
    { tool: request.toolName.toLowerCase(), args: request.args },
    state,
    { fileTokens, mentionedSymbols: [], taskDescription: request.taskDescription },
    opts.pipelineOptions,
  );

  // Record the call if it will execute
  const estTokens = request.rawPath ? (fileTokens.get(request.rawPath) ?? 0) : 0;
  if (decision.action !== 'deny' && decision.action !== 'return_cached') {
    recordToolCall(state, {
      tool: request.toolName.toLowerCase(),
      args: request.args,
      tokensConsumed: estTokens,
      durationMs: 0,
    });
  }

  saveState(statePath, state);

  // --- Translate decision to RuntimeResult with capability awareness ---
  const caps = request.capabilities;

  if (decision.action === 'deny') {
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    return {
      action: 'deny',
      output: {
        type: 'block',
        value: `[Harness] ${decision.reason} Working budget: ${remaining}/${state.budget.allocated.working} tokens.`,
      },
    };
  }

  if (decision.action === 'return_cached') {
    const cached = decision.result as { file: string; strategy: string; tokens: number; turn: number };
    if (caps.canReturnCached) {
      // Capable surface: return cached metadata directly
      return {
        action: 'return_cached',
        output: { type: 'result', file: cached.file, cached: { strategy: cached.strategy, tokens: cached.tokens, turn: cached.turn } },
      };
    }
    // Downgrade: surface cannot return cached → deny with explanation
    state.downgrades.returnCachedToDeny += 1;
    state.downgrades.total += 1;
    saveState(statePath, state);
    emitDowngrade(opts, request, 'return_cached', 'deny', `Surface ${request.surface} cannot return cached results`);
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    return {
      action: 'deny',
      output: {
        type: 'block',
        value: `[Harness] Already read ${cached.file} with same strategy (${cached.strategy}) on turn ${cached.turn}. Content is already in context. Working budget: ${remaining}/${state.budget.allocated.working} tokens.`,
      },
    };
  }

  if (decision.action === 'rewrite') {
    state.pendingRewrite = { turn: state.turn, suggestedTool: decision.tool, suggestedArgs: decision.args };
    saveState(statePath, state);

    if (caps.canRewrite) {
      // Capable surface: return executable rewrite
      return {
        action: 'rewrite',
        output: { type: 'execute', tool: decision.tool, args: decision.args },
      };
    }
    // Downgrade: surface cannot execute rewrite → advisory context
    state.downgrades.rewriteToContext += 1;
    state.downgrades.total += 1;
    saveState(statePath, state);
    emitDowngrade(opts, request, 'rewrite', 'rewrite', `Surface ${request.surface} cannot execute rewrites; advisory only`);

    const bc = decision.budgetContext;
    let msg = `[Harness] Consider using ${decision.tool} instead`;
    if (bc) {
      msg += ` — saves ~${bc.savedTokens} tokens (${Math.round(bc.savedPct * 100)}%).`;
      msg += `\nWorking budget: ${bc.remainingBudget}/${state.budget.allocated.working} tokens remaining (${bc.pressureLevel} pressure).`;
    } else {
      msg += ' — more token-efficient for this task.';
    }
    return { action: 'rewrite', output: { type: 'context', value: msg } };
  }

  if (decision.action === 'warn') {
    return { action: 'warn', output: { type: 'context', value: `[Harness] ${decision.message}` } };
  }

  return { action: 'allow' };
}
