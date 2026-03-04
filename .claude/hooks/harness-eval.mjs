// Harness evaluation layer — best-effort integration with the decision engine.
// Runs only on PreToolUse events for read-like tools.
// If the harness is not built (no dist/), skips silently.

import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';

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
export async function evaluateHarness({ event, toolName, toolInput, rawPath }) {
  // Clear state on session start
  if (event === 'SessionStart') {
    try {
      const { unlinkSync } = await import('node:fs');
      const statePath = `${process.cwd()}/.claude/harness-state.json`;
      unlinkSync(statePath);
    } catch { /* file may not exist */ }
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

    const decision = await decide(
      { tool: toolName.toLowerCase(), args: toolInput ?? {} },
      state,
      { fileTokens, mentionedSymbols: [] },
      // { llmCall: claudeCall },  // Enable when cost alternatives have closer profiles
    );

    // Record this call so state accumulates across hook invocations
    const estTokens = rawPath ? (fileTokens.get(rawPath) ?? 0) : 0;
    recordToolCall(state, {
      tool: toolName.toLowerCase(),
      args: toolInput ?? {},
      tokensConsumed: estTokens,
      durationMs: 0,
    });
    updateSignals(state);

    // Persist state
    const { writeFileSync } = await import('node:fs');
    writeFileSync(statePath, JSON.stringify(serialize(state), null, 2));

    if (decision.action === 'deny') {
      return { type: 'block', value: `[Harness] ${decision.reason}` };
    }
    if (decision.action === 'rewrite') {
      return { type: 'context', value: `[Harness] Consider using ${decision.tool}(${JSON.stringify(decision.args)}) instead — more token-efficient for this task.` };
    }
    if (decision.action === 'warn') {
      return { type: 'context', value: `[Harness] ${decision.message}` };
    }
  } catch {
    // Harness not built or other error — skip silently
  }
  return null;
}
