import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { expand } from '../../core/expand.js';
import { textResult } from './common.js';

export interface UnpackToolInput {
  compact: string;
  tableDelimiter?: string;
}

export function runUnpackTool(input: UnpackToolInput): CallToolResult {
  const output = expand(input.compact, { tableDelimiter: input.tableDelimiter });
  return textResult(output);
}

export function registerUnpackTool(server: McpServer): void {
  server.registerTool(
    'compact_md_expand',
    {
      description:
        'Expand compact.md text back to markdown. Use after compact_md_compact; do not use for arbitrary non-compact text.',
      inputSchema: {
        compact: z.string(),
        tableDelimiter: z.string().optional(),
      },
    },
    async (input) => runUnpackTool(input),
  );
}
