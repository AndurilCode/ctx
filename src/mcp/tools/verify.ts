import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { verify } from '../../core/verify.js';
import { jsonResult, resolveMarkdown } from './common.js';

export interface VerifyToolInput {
  markdown?: string;
  file?: string;
}

export async function runVerifyTool(input: VerifyToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  return jsonResult({ valid: verify(markdown) });
}

export function registerVerifyTool(server: McpServer): void {
  server.registerTool(
    'compact_md_verify',
    {
      description:
        'Verify lossless round-trip for markdown input. Pass either markdown (string) or file (absolute path).',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
      },
    },
    async (input) => runVerifyTool(input),
  );
}
