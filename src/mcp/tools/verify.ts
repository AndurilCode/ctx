import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { verifyWithDiagnostics } from '../../core/verify.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { jsonResult, resolveMarkdown } from './common.js';

export interface VerifyToolInput {
  markdown?: string;
  file?: string;
}

export async function runVerifyTool(input: VerifyToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  return jsonResult({
    ...verifyWithDiagnostics(markdown),
    frontmatter: parseFrontmatter(markdown),
  });
}

export function registerVerifyTool(server: McpServer): void {
  server.registerTool(
    'compact_md_verify',
    {
      description:
        'Verify lossless round-trip for markdown input. Returns { valid: true } on success, or { valid: false, mismatch: { line, expected, actual } } pinpointing the first line of divergence on failure.',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
      },
    },
    async (input) => runVerifyTool(input),
  );
}
