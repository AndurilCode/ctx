import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { compact } from '../../core/compact.js';
import { resolveMarkdown, textResult } from './common.js';
import { type PackLikeToolInput, toCompactOptions } from './options.js';

export interface PackToolInput extends PackLikeToolInput {
  markdown?: string;
  file?: string;
}

export async function runPackTool(input: PackToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const options = toCompactOptions(input);
  const result = compact(markdown, options);
  return textResult(result.output);
}

export function registerPackTool(server: McpServer): void {
  server.registerTool(
    'compact_md_pack',
    {
      description:
        'Compress markdown into compact.md format. Pass either markdown (string) or file (absolute path).',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
        dedup: z.boolean().optional(),
        semantic: z.boolean().optional(),
        keepComments: z.boolean().optional(),
        onlySections: z.array(z.string()).optional(),
        stripSections: z.array(z.string()).optional(),
        unwrapLines: z.boolean().optional(),
        tableDelimiter: z.string().optional(),
        versionMarker: z.boolean().optional(),
      },
    },
    async (input) => runPackTool(input),
  );
}
