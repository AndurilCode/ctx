import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { extract } from '../../core/extract.js';
import { resolveMarkdown, textResult } from './common.js';
import { type ExtractLikeToolInput, toExtractOptions } from './options.js';

export interface ExtractToolInput extends ExtractLikeToolInput {
  markdown?: string;
  file?: string;
}

export async function runExtractTool(input: ExtractToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const options = toExtractOptions(input);
  return textResult(extract(markdown, options));
}

export function registerExtractTool(server: McpServer): void {
  server.registerTool(
    'compact_md_extract',
    {
      description:
        'Create a lossy markdown summary for reading. Pass either markdown (string) or file (absolute path).',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
        onlySections: z.array(z.string()).optional(),
        stripSections: z.array(z.string()).optional(),
        maxChars: z.number().optional(),
        maxListItems: z.number().optional(),
        maxTableRows: z.number().optional(),
      },
    },
    async (input) => runExtractTool(input),
  );
}
