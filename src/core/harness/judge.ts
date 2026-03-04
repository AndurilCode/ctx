import type {
  InterceptedCall,
  StageResult,
  ScoredAlternative,
} from '../../types/harness.js';

// ── Local types ─────────────────────────────────────────────────────

export interface JudgeInput {
  tool: string;
  args: Record<string, unknown>;
  taskDescription: string;
  cacheSummary: string;
  alternatives: ScoredAlternative[];
}

// ── Prompt builder ──────────────────────────────────────────────────

/**
 * Build a structured prompt for the LLM judge that presents the
 * intercepted call, task context, cache state, and ranked alternatives.
 */
export function buildJudgePrompt(input: JudgeInput): string {
  const { tool, args, taskDescription, cacheSummary, alternatives } = input;

  const altLines = alternatives
    .map(
      (alt, i) =>
        `  ${i + 1}. ${alt.tool}(${JSON.stringify(alt.args)}) — ~${alt.estTokens} tokens, cost=${alt.cost}`,
    )
    .join('\n');

  return [
    `The agent wants to call: ${tool}(${JSON.stringify(args)})`,
    '',
    `Task: ${taskDescription}`,
    '',
    `Agent has already seen: ${cacheSummary}`,
    '',
    'Alternatives (ranked by estimated cost):',
    altLines,
    '',
    'Respond with exactly one of:',
    '- ALLOW (proceed with original call)',
    '- REWRITE: tool(key=value, ...) (use an alternative)',
    '',
    'Choose the approach that gets the agent what it needs at minimum cost.',
  ].join('\n');
}

// ── Response parser ─────────────────────────────────────────────────

const REWRITE_RE = /^REWRITE:\s*(\w+)\(([^)]*)\)\s*$/;

/**
 * Parse the LLM judge response into a StageResult.
 *
 * - `ALLOW` -> { outcome: 'allow' }
 * - `REWRITE: tool(key=value, ...)` -> { outcome: 'rewrite', tool, args }
 * - Anything else -> { outcome: 'allow' } (safe fallback)
 */
export function parseJudgeResponse(response: string): StageResult {
  const trimmed = response.trim();

  if (trimmed === 'ALLOW') {
    return { outcome: 'allow' };
  }

  const match = REWRITE_RE.exec(trimmed);
  if (!match) {
    return { outcome: 'allow' };
  }

  const tool = match[1] ?? '';
  const rawPairs = match[2] ?? '';
  const args: Record<string, unknown> = {};

  if (rawPairs.trim().length > 0) {
    const pairs = rawPairs.split(', ');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;

      const key = pair.slice(0, eqIdx).trim();
      let value: unknown = pair.slice(eqIdx + 1).trim();

      // Strip surrounding quotes
      if (
        typeof value === 'string' &&
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = (value as string).slice(1, -1);
      }

      // Parse numbers
      if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
        value = Number(value);
      }

      args[key] = value;
    }
  }

  return { outcome: 'rewrite', tool, args };
}

// ── Evaluate with judge ─────────────────────────────────────────────

/**
 * End-to-end judge evaluation: build prompt, call LLM, parse response.
 *
 * The `llmCall` function is dependency-injected so the harness stays
 * SDK-agnostic and tests can mock it easily.
 *
 * On any llmCall error, falls back to { outcome: 'allow' }.
 */
export async function evaluateWithJudge(
  call: InterceptedCall,
  input: Omit<JudgeInput, 'tool' | 'args'>,
  llmCall: (prompt: string) => Promise<string>,
): Promise<StageResult> {
  const fullInput: JudgeInput = {
    tool: call.tool,
    args: call.args,
    ...input,
  };

  const prompt = buildJudgePrompt(fullInput);

  let response: string;
  try {
    response = await llmCall(prompt);
  } catch {
    return { outcome: 'allow' };
  }

  return parseJudgeResponse(response);
}
