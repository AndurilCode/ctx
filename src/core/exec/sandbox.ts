import { createContext, Script } from 'node:vm';
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

  // Build a V8 isolate via node:vm — no prototype chain to walk back to host globals
  const sandbox = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(api)) {
    sandbox[key] = value;
  }

  const ctx = createContext(sandbox);

  // Lock down dynamic code generation and host-scope escape paths
  const lockdown = new Script(`
    (function() {
      const deny = () => { throw new TypeError('Dynamic code generation is not available in sandbox'); };
      // Block .constructor escape on sync, async, generator, and async-generator Function prototypes
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const GeneratorFunction = Object.getPrototypeOf(function*(){}).constructor;
      const AsyncGeneratorFunction = Object.getPrototypeOf(async function*(){}).constructor;
      for (const F of [Function, AsyncFunction, GeneratorFunction, AsyncGeneratorFunction]) {
        Object.defineProperty(F.prototype, 'constructor', { get: deny, set: deny, configurable: false });
      }
      // Block direct Function/eval/globalThis access
      Object.defineProperty(this, 'Function', { value: undefined, writable: false, configurable: false });
      Object.defineProperty(this, 'eval', { value: undefined, writable: false, configurable: false });
      Object.defineProperty(this, 'globalThis', { value: undefined, writable: false, configurable: false });
    })();
  `);
  lockdown.runInContext(ctx);

  // Compile user code as an async IIFE inside the isolated context
  let script: Script;
  try {
    script = new Script(`(async () => {\n${opts.code}\n})()`, {
      filename: 'exec-sandbox',
    });
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
    const promise = script.runInContext(ctx) as Promise<unknown>;
    result = await Promise.race([
      promise,
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
