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
    'compact_md_code_outline',
    {
      description:
        'Parse source code and return a structural outline with line numbers for classes, functions, interfaces, and types. Prefer this over reading full files when exploring a codebase, then read only specific line ranges you need.',
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
