// Harness evaluation layer — best-effort integration with the decision engine.
// Runs only on PreToolUse events for read-like tools.
// If the harness is not built (no dist/), skips silently.

import { readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { formatSuggestion } from './harness-format.mjs';

let harnessWarned = false;

// Atomic write: write to temp file then rename to avoid corruption under parallel calls.
// NOTE: Under parallel tool calls, concurrent reads may see slightly stale state.
// This is acceptable — budget tracking is advisory, not a hard gate.
function atomicWriteSync(filePath, data) {
  const tmp = filePath + '.tmp.' + process.pid;
  writeFileSync(tmp, data);
  renameSync(tmp, filePath);
}

/**
 * Call Claude CLI as the LLM judge.
 * Uses `claude -p` (print mode) with the haiku model for speed/cost.
 * Returns the raw text response, or throws on failure.
 */
function claudeCall(prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p', '--model', 'haiku', '--max-turns', '1'], {
      timeout: 5000,
      maxBuffer: 64 * 1024,
    }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Evaluate the harness decision engine for a read-tool invocation.
 *
 * @param {{ event: string, toolName: string, toolInput: Record<string, unknown>, rawPath: string }} ctx
 * @returns {Promise<string|null>} Advisory text to append to additionalContext, or null.
 */
export async function evaluateHarness({ event, toolName, toolInput, rawPath, prompt }) {
  // Clear state on session start or context compaction
  if (event === 'SessionStart' || event === 'PreCompact') {
    try {
      const { unlinkSync } = await import('node:fs');
      const statePath = `${process.cwd()}/.claude/harness-state.json`;
      unlinkSync(statePath);
    } catch { /* file may not exist */ }

    // Check harness build status
    const distPath = new URL('../../dist/index.js', import.meta.url).pathname;
    if (!existsSync(distPath)) {
      console.error('[Harness] dist/ not built — budget tracking disabled. Run: bun run build');
    }

    return null;
  }

  // Classify intent on prompt submit → persist profile into state
  if (event === 'UserPromptSubmit' && prompt) {
    try {
      const { buildProfile, createHarnessState, serialize, deserialize } = await import(
        new URL('../../dist/index.js', import.meta.url).pathname
      );
      const statePath = `${process.cwd()}/.claude/harness-state.json`;
      let state;
      try {
        const raw = readFileSync(statePath, 'utf8');
        state = deserialize(JSON.parse(raw));
      } catch {
        state = createHarnessState({ contextWindow: 200_000 });
      }
      const profile = buildProfile(prompt, state.signals);
      state.profile = profile;
      atomicWriteSync(statePath, JSON.stringify(serialize(state), null, 2));
    } catch { /* harness not built */ }
    return null;
  }

  // Emit session metrics on Stop
  if (event === 'Stop') {
    try {
      const { deserialize, computeMetrics } = await import(
        new URL('../../dist/index.js', import.meta.url).pathname
      );
      const statePath = `${process.cwd()}/.claude/harness-state.json`;
      const raw = readFileSync(statePath, 'utf8');
      const state = deserialize(JSON.parse(raw));
      const metrics = computeMetrics(state);
      const logPath = `${process.cwd()}/.claude/harness-metrics.log`;
      const { appendFileSync } = await import('node:fs');
      appendFileSync(logPath, JSON.stringify({ timestamp: new Date().toISOString(), taskType: state.profile.type, ...metrics }) + '\n');
    } catch { /* harness not built or no state */ }
    return null;
  }

  if (event !== 'PreToolUse') return null;

  const HARNESS_TOOLS = new Set(['Read', 'Grep', 'Glob']);
  if (!HARNESS_TOOLS.has(toolName)) return null;

  try {
    const { createHarnessState, decide, serialize, deserialize, recordToolCall, updateSignals } = await import(
      new URL('../../dist/index.js', import.meta.url).pathname
    );

    const statePath = `${process.cwd()}/.claude/harness-state.json`;

    let state;
    try {
      const raw = readFileSync(statePath, 'utf8');
      state = deserialize(JSON.parse(raw));
    } catch {
      state = createHarnessState({ contextWindow: 200_000 });
    }

    const fileTokens = new Map();
    if (rawPath) {
      try {
        const { statSync } = await import('node:fs');
        const stat = statSync(rawPath);
        fileTokens.set(rawPath, Math.ceil(stat.size / 4));
      } catch { /* file may not exist yet */ }
    }

    // Normalize file_path → file so the internal engine uses a consistent key
    const normalizedArgs = { ...(toolInput ?? {}) };
    if (normalizedArgs.file_path && !normalizedArgs.file) {
      normalizedArgs.file = normalizedArgs.file_path;
    }

    const decision = await decide(
      { tool: toolName.toLowerCase(), args: normalizedArgs },
      state,
      { fileTokens, mentionedSymbols: [] },
      // { llmCall: claudeCall },  // Enable when cost alternatives have closer profiles
    );

    // Record the call if it will actually execute. Advisory rewrites
    // (returned as context) don't block — the original call still runs.
    // Only deny truly prevents execution.
    const estTokens = rawPath ? (fileTokens.get(rawPath) ?? 0) : 0;
    if (decision.action !== 'deny') {
      recordToolCall(state, {
        tool: toolName.toLowerCase(),
        args: normalizedArgs,
        tokensConsumed: estTokens,
        durationMs: 0,
      });
    }

    // Persist state
    atomicWriteSync(statePath, JSON.stringify(serialize(state), null, 2));

    if (decision.action === 'deny') {
      const remaining = state.budget.allocated.working - state.budget.consumed.working;
      return { type: 'block', value: `[Harness] ${decision.reason} Working budget: ${remaining}/${state.budget.allocated.working} tokens.` };
    }
    if (decision.action === 'rewrite') {
      state.pendingRewrite = { turn: state.turn, suggestedTool: decision.tool, suggestedArgs: decision.args };
      // Persist state with pendingRewrite (rewrite calls are not recorded, so persist here)
      atomicWriteSync(statePath, JSON.stringify(serialize(state), null, 2));

      const bc = decision.budgetContext;
      const suggestion = formatSuggestion(decision.tool, decision.args);
      let msg = `[Harness] Consider ${suggestion} instead`;
      if (bc) {
        msg += ` — saves ~${bc.savedTokens} tokens (${Math.round(bc.savedPct * 100)}%).`;
        msg += `\nWorking budget: ${bc.remainingBudget}/${state.budget.allocated.working} tokens remaining (${bc.pressureLevel} pressure).`;
      } else {
        msg += ' — more token-efficient for this task.';
      }
      return { type: 'context', value: msg };
    }
    if (decision.action === 'warn') {
      return { type: 'context', value: `[Harness] ${decision.message}` };
    }
  } catch {
    if (!harnessWarned) {
      harnessWarned = true;
      console.error('[Harness] Could not load harness engine — budget tracking disabled');
    }
  }
  return null;
}
