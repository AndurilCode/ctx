import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { symbols } from '../../core/symbols.js';
import { textResult } from './common.js';

export interface SymbolsToolInput {
  query: string;
  path?: string;
  glob?: string;
  kind?: string;
}

export async function runSymbolsTool(input: SymbolsToolInput): Promise<CallToolResult> {
  const result = await symbols({
    query: input.query,
    path: input.path,
    glob: input.glob,
    kind: input.kind as import('../../types/outline.js').OutlineNodeKind | undefined,
  });
  return textResult(result.output);
}

export function registerSymbolsTool(server: McpServer): void {
  server.registerTool(
    'compact_md_symbols',
    {
      description:
        'Cross-file symbol search. Find where a symbol is defined and used across the project. Returns definitions with file paths and line numbers, plus usage sites.',
      inputSchema: {
        query: z.string().describe('Symbol name to search for (exact or substring match)'),
        path: z.string().optional().describe('Directory to search (default: cwd)'),
        glob: z.string().optional().describe('File filter, e.g. "**/*.ts"'),
        kind: z
          .enum(['function', 'class', 'method', 'interface', 'type', 'enum', 'variable', 'import', 'export'])
          .optional()
          .describe('Filter by symbol kind'),
      },
    },
    async (input) => runSymbolsTool(input),
  );
}
