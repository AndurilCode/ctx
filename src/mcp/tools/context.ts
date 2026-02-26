import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { assembleContext } from '../../core/context.js';
import type { ReadStrategy } from '../../types/read.js';

export interface ContextToolInput {
  sources: Array<{ file: string; sections?: string[]; priority?: 'high' | 'normal' | 'low' }>;
  maxTokens: number;
  strategy?: string;
}

export async function runContextTool(input: ContextToolInput): Promise<CallToolResult> {
  const result = await assembleContext({
    sources: input.sources,
    maxTokens: input.maxTokens,
    strategy: input.strategy as ReadStrategy | undefined,
  });
  return {
    content: [
      { type: 'text', text: result.content },
      {
        type: 'text',
        text: JSON.stringify(
          { totalTokens: result.totalTokens, budget: result.budget, sources: result.sources },
          null,
          2,
        ),
      },
    ],
  };
}

export function registerContextTool(server: McpServer): void {
  server.registerTool(
    'compact_md_context',
    {
      description:
        'Assemble a token-budgeted context document from an explicit source list. Use when you already chose files; do not use for discovery (use compact_md_gather or compact_md_rank).',
      inputSchema: {
        sources: z.array(
          z.object({
            file: z.string(),
            sections: z.array(z.string()).optional(),
            priority: z.enum(['high', 'normal', 'low']).optional(),
          }),
        ),
        maxTokens: z.number().int().min(1).describe('Total token budget for all sources combined'),
        strategy: z
          .enum(['auto', 'truncate', 'outline', 'sections', 'summarize'])
          .optional()
          .describe('Override compression strategy for all sources'),
      },
    },
    async (input) => runContextTool(input),
  );
}
