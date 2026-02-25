import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { extract } from '../../core/extract.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { resolveMarkdown, textResultWithFrontmatter } from './common.js';
import { type ExtractLikeToolInput, toExtractOptions } from './options.js';

export interface ExtractToolInput extends ExtractLikeToolInput {
  markdown?: string;
  file?: string;
}

export async function runExtractTool(input: ExtractToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const options = toExtractOptions(input);
  return textResultWithFrontmatter(extract(markdown, options), parseFrontmatter(markdown));
}

export function registerExtractTool(server: McpServer): void {
  server.registerTool(
    'compact_md_extract',
    {
      description:
        'Retrieve verbatim section content with optional truncation. Best used after compact_md_sections reveals which section you need — target it by heading name via onlySections. Returns exact content with no AI summarization. To get a compressed summary of a specific section instead of the full text, use compact_md_summarize with onlySections — that combines section targeting with LLM compression.',
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
