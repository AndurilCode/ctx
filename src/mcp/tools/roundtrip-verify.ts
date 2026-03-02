import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { verifyRoundTripWithDiagnostics } from '../../core/roundtrip-verify.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { jsonResult, resolveMarkdown } from './common.js';

export interface RoundtripVerifyToolInput {
  markdown?: string;
  file?: string;
}

export async function runRoundtripVerifyTool(
  input: RoundtripVerifyToolInput,
): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  return jsonResult({
    ...verifyRoundTripWithDiagnostics(markdown),
    frontmatter: parseFrontmatter(markdown),
  });
}

export function registerRoundtripVerifyTool(server: McpServer): void {
  server.registerTool(
    'ctx_roundtrip_verify',
    {
      description:
        'Verify lossless round-trip for markdown input. Use to enforce fidelity guarantees; do not use as a compressor or reader.',
      inputSchema: {
        markdown: z.string().optional().describe('Markdown source text (Markdown-only).'),
        file: z.string().optional().describe('Path to a markdown file (.md/.mdx/.markdown).'),
      },
    },
    async (input) => runRoundtripVerifyTool(input),
  );
}
