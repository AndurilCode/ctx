import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { fileImports } from '../../core/imports.js';
import { textResult } from './common.js';

export interface ImportsToolInput {
  file: string;
  direction?: 'both' | 'incoming' | 'outgoing';
  root?: string;
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
        'Show import/dependency graph for a file — what it imports and what imports it. Helps agents understand code connectivity without reading all files.',
      inputSchema: {
        file: z.string().describe('File path to analyze'),
        direction: z
          .enum(['both', 'incoming', 'outgoing'])
          .optional()
          .describe('Which edges to show (default: both)'),
        root: z.string().optional().describe('Project root for resolving imports (default: cwd)'),
      },
    },
    async (input) => runImportsTool(input),
  );
}
