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
    'compact_md_pack',
    {
      description:
        'Losslessly compress markdown into compact.md format (token savings ~0–30% depending on doc structure). For lossy compression that strips boilerplate and keeps only key content, use compact_md_summarize or compact_md_extract instead — those trade fidelity for much higher token reduction.',
      inputSchema: packLikeInputSchema,
    },
    async (input) => runPackTool(input),
  );
}
