import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { compact } from '../../core/compact.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { resolveMarkdown, textResultWithFrontmatter } from './common.js';
import { type PackLikeToolInput, packLikeInputSchema, toCompactOptions } from './options.js';

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
    'ctx_compact',
    {
      description:
        'Losslessly compress markdown into compact format. Use when reversibility matters; do not use for aggressive lossy reduction (use ctx_summarize or ctx_extract).',
      inputSchema: packLikeInputSchema,
    },
    async (input) => runPackTool(input),
  );
}
