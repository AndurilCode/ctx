import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { tree } from '../../core/tree.js';
import { textResult } from './common.js';

export interface TreeToolInput {
  path?: string;
  glob?: string;
  depth?: number;
  ignore?: string[];
  concurrency?: number;
}

export async function runTreeTool(input: TreeToolInput): Promise<CallToolResult> {
  const result = await tree(input);
  const header = `${result.root} (${result.totalTokens} tokens, ${result.totalFiles} files)\n\n`;
  return textResult(header + result.output);
}

export function registerTreeTool(server: McpServer): void {
  server.registerTool(
    'compact_md_tree',
    {
      description:
        'Show a directory tree with per-file token counts. Use to budget navigation at repo scale; do not use for semantic relevance ranking (use compact_md_rank).',
      inputSchema: {
        path: z.string().optional().describe('Directory path (default: cwd)'),
        glob: z.string().optional().describe('Filter pattern, e.g. "**/*.ts"'),
        depth: z.number().int().min(0).optional().describe('Max directory depth (default: 3)'),
        ignore: z.array(z.string()).optional().describe('Additional ignore patterns'),
        concurrency: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Max concurrent filesystem workers (default: 16)'),
      },
    },
    async (input) => runTreeTool(input),
  );
}
