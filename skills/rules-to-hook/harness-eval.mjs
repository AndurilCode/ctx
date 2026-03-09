// Thin claude-hook adapter over the core harness runtime.
// Preserves the evaluateHarness() export contract for engine.mjs.

import { existsSync } from 'node:fs';

let harnessWarned = false;

export async function evaluateHarness({ event, toolName, toolInput, rawPath, prompt }) {
  // Check harness build on session start
  if (event === 'SessionStart' || event === 'PreCompact') {
    const distPath = new URL('../../dist/index.js', import.meta.url).pathname;
    if (!existsSync(distPath)) {
      console.error('[Harness] dist/ not built — budget tracking disabled. Run: bun run build');
    }
  }

  try {
    const { evaluate, buildRequest, resolveStatePath } = await import(
      new URL('../../dist/index.js', import.meta.url).pathname
    );

    const statePath = resolveStatePath(process.cwd());
    // Skip evaluation if no harness state exists (e.g. temp test workspaces)
    if (!existsSync(statePath)) return null;
    const metricsPath = `${process.cwd()}/.claude/harness-metrics.log`;

    const request = buildRequest({
      surface: 'claude-hook',
      event,
      toolName: toolName ?? '',
      toolInput: toolInput ?? {},
      rawPath,
      prompt,
    });

    const result = await evaluate(request, { statePath, metricsPath });

    if (result.action === 'noop' || result.action === 'allow') return null;
    return result.output;
  } catch {
    if (!harnessWarned) {
      harnessWarned = true;
      console.error('[Harness] Could not load harness engine — budget tracking disabled');
    }
    return null;
  }
}
