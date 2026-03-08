import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { executeCode } from '../../core/exec/index.js';
import type { ExecResult } from '../../core/exec/types.js';
import { textResult } from './common.js';

export interface ExecToolInput {
  code: string;
  allowWrite?: boolean;
  timeout?: number;
}

export async function runExecTool(input: ExecToolInput) {
  const result: ExecResult = await executeCode({
    code: input.code,
    allowWrite: input.allowWrite,
    timeout: input.timeout,
  });

  const parts: string[] = [];
  if (result.output) {
    parts.push(result.output);
  }
  if (result.error) {
    parts.push(`\n${result.error.name}: ${result.error.message}`);
  }

  const meta = {
    success: result.success,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
    truncated: result.truncated,
  };

  return {
    content: [
      { type: 'text' as const, text: parts.join('\n') || '(no output)' },
      { type: 'text' as const, text: JSON.stringify(meta, null, 2) },
    ],
    isError: !result.success,
  };
}

export function registerExecTool(server: McpServer): void {
  server.registerTool(
    'ctx_exec',
    {
      description:
        'Execute a JavaScript code block with ctx API functions pre-loaded in a sandboxed scope. ' +
        'Available functions (all async): tree, read, context, gather, rank, focus, symbols, ' +
        'imports, outline, tokenCount, log, json. Use await for async calls. ' +
        'With allowWrite: patch, insert, rename. Output is captured via log()/json() and returned.',
      inputSchema: {
        code: z.string().describe('JavaScript code to execute (max 16KB)'),
        allowWrite: z
          .boolean()
          .optional()
          .describe('Enable write operations: patch, insert, rename (default: false)'),
        timeout: z
          .number()
          .int()
          .min(1000)
          .max(120000)
          .optional()
          .describe('Timeout in ms (default: 30000)'),
      },
    },
    async (input) => runExecTool(input),
  );
}
