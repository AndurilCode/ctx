import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { tokenCount } from '../../core/token-count.js';
import { jsonResult } from './common.js';

export interface TokenCountToolInput {
  text?: string;
  file?: string;
}

export async function runTokenCountTool(input: TokenCountToolInput): Promise<CallToolResult> {
  const result = await tokenCount({ text: input.text, file: input.file });
  return jsonResult(result);
}

export function registerTokenCountTool(server: McpServer): void {
  server.registerTool(
    'compact_md_tokens',
    {
      description:
        'Count tokens for a file or string without returning content. Use to estimate cost before reading; do not use for retrieval (use compact_md_read).',
      inputSchema: {
        text: z.string().optional(),
        file: z.string().optional(),
      },
    },
    async (input) => runTokenCountTool(input),
  );
}
