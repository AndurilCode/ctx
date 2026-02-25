import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { compact } from '../../core/compact.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { resolveMarkdown, textResultWithFrontmatter } from './common.js';
import { type PackLikeToolInput, toCompactOptions } from './options.js';

export interface PackToolInput extends PackLikeToolInput {
  markdown?: string;
  file?: string;
}

export async function runPackTool(input: PackToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const options = toCompactOptions(input);
  const result = compact(markdown, options);
  return textResultWithFrontmatter(result.output, parseFrontmatter(markdown));
}

export function registerPackTool(server: McpServer): void {
  server.registerTool(
    'compact_md_pack',
    {
      description:
        'Losslessly compress markdown into compact.md format (token savings ~0–30% depending on doc structure). For lossy compression that strips boilerplate and keeps only key content, use compact_md_summarize or compact_md_extract instead — those trade fidelity for much higher token reduction.',
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
