import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { budgetedRead } from '../../core/read.js';
import type { ReadStrategy } from '../../types/read.js';

export interface ReadToolInput {
  file: string;
  maxTokens?: number;
  strategy?: string;
  lineHashes?: boolean;
}

export async function runReadTool(input: ReadToolInput): Promise<CallToolResult> {
  const result = await budgetedRead({
    file: input.file,
    maxTokens: input.maxTokens,
    strategy: input.strategy as ReadStrategy | undefined,
    lineHashes: input.lineHashes,
  });
  return {
    content: [
      { type: 'text', text: result.content },
      {
        type: 'text',
        text: JSON.stringify(
          {
            strategy: result.strategy,
            totalTokens: result.totalTokens,
            returnedTokens: result.returnedTokens,
            truncated: result.truncated,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function registerReadTool(server: McpServer): void {
  server.registerTool(
    'ctx_read',
    {
      description:
        'Read one file within a token budget using strategy-aware compression. Use for targeted single-file access; do not use to build multi-file context (use ctx_context or ctx_gather).',
      inputSchema: {
        file: z.string().describe('File path to read'),
        maxTokens: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Token budget (omit for full content)'),
        strategy: z
          .enum(['auto', 'truncate', 'outline', 'sections', 'summarize'])
          .optional()
          .describe('Strategy override (default: auto)'),
        lineHashes: z
          .boolean()
          .optional()
          .describe(
            'Annotate each line with 2-char content hash for use with ctx_patch line-hash mode',
          ),
      },
    },
    async (input) => runReadTool(input),
  );
}
