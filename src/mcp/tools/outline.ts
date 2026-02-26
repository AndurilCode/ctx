import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { codeOutline } from '../../core/code-outline.js';
import { resolveTextInput, textResult } from './common.js';
import { codeOrFileSchema } from './options.js';

export interface OutlineToolInput {
  code?: string;
  file?: string;
  language?: string;
  depth?: number;
  collapseImports?: boolean;
}

export async function runOutlineTool(input: OutlineToolInput): Promise<CallToolResult> {
  const source = await resolveTextInput({ text: input.code, file: input.file });
  const result = await codeOutline(source, {
    filePath: input.file,
    language: input.language,
    depth: input.depth,
    collapseImports: input.collapseImports,
  });
  return textResult(result.output);
}

export function registerOutlineTool(server: McpServer): void {
  server.registerTool(
    'compact_md_outline',
    {
      description:
        'Return a structural code outline with line numbers (classes/functions/types). Use for fast code navigation; do not use when exact source text is required (use compact_md_read).',
      inputSchema: {
        ...codeOrFileSchema,
        language: z.string().optional(),
        depth: z.number().int().positive().optional(),
        collapseImports: z.boolean().optional(),
      },
    },
    async (input) => runOutlineTool(input),
  );
}
