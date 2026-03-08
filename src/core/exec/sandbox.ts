import { buildApiSurface } from './api-surface.js';
import { createTokenCounter } from '../../utils/tokens.js';
import type { ExecOptions, ExecResult } from './types.js';

const MAX_CODE_SIZE = 16 * 1024; // 16KB
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 50_000;

export async function executeInSandbox(opts: ExecOptions): Promise<ExecResult> {
  const cwd = opts.cwd ?? process.cwd();
  const timeoutMs = Math.min(opts.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  // Validate code size
  if (Buffer.byteLength(opts.code, 'utf8') > MAX_CODE_SIZE) {
    return {
      success: false,
      output: '',
      error: { name: 'CodeSizeError', message: `Code exceeds maximum size of ${MAX_CODE_SIZE} bytes` },
      tokensUsed: 0,
      durationMs: 0,
      truncated: false,
    };
  }

  const outputBuffer: string[] = [];
  const api = buildApiSurface(cwd, { allowWrite: opts.allowWrite ?? false, outputBuffer });

  // Shadow dangerous globals by injecting them as undefined parameters
  const shadowedGlobals = [
    'process', 'require', 'Bun', 'Deno',
    'globalThis', 'global',
    'fs', 'child_process', 'net', 'http', 'https',
    '__filename', '__dirname', 'module', 'exports',
  ];

  const paramNames = [...Object.keys(api), ...shadowedGlobals];
  const paramValues: unknown[] = [
    ...Object.values(api),
    ...shadowedGlobals.map(() => undefined),
  ];

  // Construct AsyncFunction
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<unknown>;

  let fn: (...args: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction(...paramNames, opts.code);
  } catch (err) {
    const e = err as Error;
    return {
      success: false,
      output: '',
      error: { name: e.name, message: e.message, stack: e.stack },
      tokensUsed: 0,
      durationMs: 0,
      truncated: false,
    };
  }

  const start = performance.now();
  let result: unknown;
  let error: ExecResult['error'];
  let success = true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    result = await Promise.race([
      fn(...paramValues),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Execution timed out')), timeoutMs);
      }),
    ]);
  } catch (err) {
    success = false;
    const e = err as Error;
    error = { name: e.name ?? 'Error', message: e.message, stack: e.stack };
  } finally {
    if (timer) clearTimeout(timer);
  }

  const durationMs = Math.round(performance.now() - start);

  // Assemble output and check truncation
  let output = outputBuffer.join('\n');
  let truncated = false;

  const counter = await createTokenCounter();
  let tokensUsed = counter.count(output);

  if (tokensUsed > maxOutputTokens) {
    // Truncate by finding a cut point
    truncated = true;
    const chars = output.split('');
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (counter.count(output.slice(0, mid)) <= maxOutputTokens) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    output = output.slice(0, Math.max(0, lo - 1)) + '\n\n[output truncated]';
    tokensUsed = counter.count(output);
  }

  return { success, output, result, error, tokensUsed, durationMs, truncated };
}
