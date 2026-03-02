import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { autoContext } from '../../core/auto-context.js';

export interface AutoContextToolInput {
  query: string;
  maxTokens: number;
  path?: string;
  seeds?: string[];
  depth?: number;
  glob?: string;
  maxFiles?: number;
}

export async function runAutoContextTool(input: AutoContextToolInput): Promise<CallToolResult> {
  const result = await autoContext(input);
  return {
    content: [
      { type: 'text', text: result.content },
      {
        type: 'text',
        text: JSON.stringify(
          {
            totalTokens: result.totalTokens,
            budget: result.budget,
            selectedFiles: result.selectedFiles,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function registerAutoContextTool(server: McpServer): void {
  server.registerTool(
    'ctx_gather',
    {
      description:
        'Discover, rank, and assemble context for a query in one call. Use when file selection should be automatic; do not use when sources are already known (use ctx_context).',
      inputSchema: {
        query: z.string().describe('Task description or question to find context for'),
        maxTokens: z.number().int().min(1).describe('Total token budget for assembled context'),
        path: z.string().optional().describe('Root directory to search (default: cwd)'),
        seeds: z.array(z.string()).optional().describe('Files to always include at high priority'),
        depth: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Import graph expansion hops (default: 1, 0 = none)'),
        glob: z.string().optional().describe('File glob pattern (default: **/*.{ts,tsx,js,jsx})'),
        maxFiles: z.number().int().min(1).optional().describe('Max files to include (default: 15)'),
      },
    },
    async (input) => runAutoContextTool(input),
  );
}
