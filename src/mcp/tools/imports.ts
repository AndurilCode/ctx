import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { fileImports } from '../../core/imports.js';
import { textResult } from './common.js';

export interface ImportsToolInput {
  file: string;
  direction?: 'both' | 'incoming' | 'outgoing';
  root?: string;
  concurrency?: number;
}

export async function runImportsTool(input: ImportsToolInput): Promise<CallToolResult> {
  const result = await fileImports(input);
  return textResult(result.output);
}

export function registerImportsTool(server: McpServer): void {
  server.registerTool(
    'compact_md_imports',
    {
      description:
        'Show incoming and outgoing import edges for a file. Use for dependency flow analysis; do not use for symbol-level usages (use compact_md_symbols).',
      inputSchema: {
        file: z.string().describe('File path to analyze'),
        direction: z
          .enum(['both', 'incoming', 'outgoing'])
          .optional()
          .describe('Which edges to show (default: both)'),
        root: z.string().optional().describe('Project root for resolving imports (default: cwd)'),
        concurrency: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Max concurrent filesystem workers (default: 16)'),
      },
    },
    async (input) => runImportsTool(input),
  );
}
