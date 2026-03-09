import type { HarnessRequest, RuntimeResult, JournalEventData } from '../../types/harness.js';
import type { RuntimeOptions } from './runtime.js';
import type { StorePaths } from './store.js';
import type { HarnessState } from '../../types/harness.js';
import { recordToolCall } from './state.js';
import { appendStateEvent, compact } from './store.js';
import { decide } from './pipeline.js';
import { statSync } from 'node:fs';
import { emitDowngrade } from './runtime.js';

const HARNESS_TOOLS = new Set(['Read', 'Grep', 'Glob', 'Edit', 'Write', 'MultiEdit']);

export function isHarnessTool(toolName: string): boolean {
  return HARNESS_TOOLS.has(toolName);
}

export async function mediatePreToolUse(
  request: HarnessRequest,
  opts: RuntimeOptions,
  paths: StorePaths,
  state: HarnessState,
  journalEntries: number,
): Promise<RuntimeResult> {
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

  const estTokens = request.rawPath ? (fileTokens.get(request.rawPath) ?? 0) : 0;
  let newEvents = 0;

  if (decision.action !== 'deny' && decision.action !== 'return_cached' && decision.action !== 'inject_before') {
    const record = {
      tool: request.toolName.toLowerCase(),
      args: request.args,
      tokensConsumed: estTokens,
      durationMs: 0,
    };
    recordToolCall(state, record);
    appendStateEvent(paths, { type: 'tool_call', record });
    newEvents++;
  }

  const caps = request.capabilities;
  const maybeCompact = () => {
    if (journalEntries + newEvents >= 50) compact(paths, state);
  };

  if (decision.action === 'deny') {
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    // Record the call since we're allowing it through as a warning
    const record = {
      tool: request.toolName.toLowerCase(),
      args: request.args,
      tokensConsumed: estTokens,
      durationMs: 0,
    };
    recordToolCall(state, record);
    appendStateEvent(paths, { type: 'tool_call', record });
    newEvents++;
    maybeCompact();
    return {
      action: 'warn',
      output: {
        type: 'context',
        value: `[Harness] ${decision.reason} Working budget: ${remaining}/${state.budget.allocated.working} tokens.`,
      },
    };
  }

  if (decision.action === 'return_cached') {
    const cached = decision.result as { file: string; strategy: string; tokens: number; turn: number };
    if (caps.canReturnCached) {
      maybeCompact();
      return {
        action: 'return_cached',
        output: { type: 'result', file: cached.file, cached: { strategy: cached.strategy, tokens: cached.tokens, turn: cached.turn } },
      };
    }
    state.downgrades.returnCachedToDeny += 1;
    state.downgrades.total += 1;
    appendStateEvent(paths, { type: 'downgrade', key: 'returnCachedToDeny' });
    newEvents++;
    emitDowngrade(opts, request, 'return_cached', 'warn', `Surface ${request.surface} cannot return cached results`);
    const remaining = state.budget.allocated.working - state.budget.consumed.working;
    maybeCompact();
    return {
      action: 'warn',
      output: {
        type: 'context',
        value: `[Harness] Already read ${cached.file} with same strategy (${cached.strategy}) on turn ${cached.turn}. Content is already in context. Working budget: ${remaining}/${state.budget.allocated.working} tokens.`,
      },
    };
  }

  if (decision.action === 'inject_before') {
    const calls = decision.calls;
    if (caps.canInjectBefore) {
      // Record the original call — it will proceed after injected calls
      const record = {
        tool: request.toolName.toLowerCase(),
        args: request.args,
        tokensConsumed: estTokens,
        durationMs: 0,
      };
      recordToolCall(state, record);
      appendStateEvent(paths, { type: 'tool_call', record });
      newEvents++;
      maybeCompact();
      return {
        action: 'inject_before',
        output: { type: 'inject', calls, reason: `Mutation safety: reading required files before ${request.toolName}` },
      };
    }
    state.downgrades.injectBeforeToWarn += 1;
    state.downgrades.total += 1;
    appendStateEvent(paths, { type: 'downgrade', key: 'injectBeforeToWarn' });
    newEvents++;
    emitDowngrade(opts, request, 'inject_before', 'warn', `Surface ${request.surface} cannot inject calls before tool execution`);
    // Still record the call and let it through with a warning
    const record = {
      tool: request.toolName.toLowerCase(),
      args: request.args,
      tokensConsumed: estTokens,
      durationMs: 0,
    };
    recordToolCall(state, record);
    appendStateEvent(paths, { type: 'tool_call', record });
    newEvents++;
    const fileList = calls.map(c => c.args['file'] as string).filter(Boolean).join(', ');
    maybeCompact();
    return {
      action: 'warn',
      output: {
        type: 'context',
        value: `[Harness] Mutation safety: you should read ${fileList} before modifying. Evidence is missing or stale.`,
      },
    };
  }

  if (decision.action === 'rewrite') {
    state.pendingRewrite = { turn: state.turn, suggestedTool: decision.tool, suggestedArgs: decision.args };
    appendStateEvent(paths, { type: 'pending_rewrite', rewrite: state.pendingRewrite });
    newEvents++;

    if (caps.canRewrite) {
      maybeCompact();
      return {
        action: 'rewrite',
        output: { type: 'execute', tool: decision.tool, args: decision.args },
      };
    }
    state.downgrades.rewriteToContext += 1;
    state.downgrades.total += 1;
    appendStateEvent(paths, { type: 'downgrade', key: 'rewriteToContext' });
    newEvents++;
    emitDowngrade(opts, request, 'rewrite', 'rewrite', `Surface ${request.surface} cannot execute rewrites; advisory only`);

    const bc = decision.budgetContext;
    let msg = `[Harness] Consider using ${decision.tool} instead`;
    if (bc) {
      msg += ` — saves ~${bc.savedTokens} tokens (${Math.round(bc.savedPct * 100)}%).`;
      msg += `\nWorking budget: ${bc.remainingBudget}/${state.budget.allocated.working} tokens remaining (${bc.pressureLevel} pressure).`;
    } else {
      msg += ' — more token-efficient for this task.';
    }
    maybeCompact();
    return { action: 'rewrite', output: { type: 'context', value: msg } };
  }

  if (decision.action === 'warn') {
    maybeCompact();
    return { action: 'warn', output: { type: 'context', value: `[Harness] ${decision.message}` } };
  }

  maybeCompact();
  return { action: 'allow' };
}
