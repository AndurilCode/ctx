import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { insert } from '../../core/insert.js';
import { textResult } from './common.js';

export function registerInsertTool(server: McpServer): void {
  server.registerTool(
    'ctx_insert',
    {
      description:
        "Insert a new symbol into a source file. Position is expressed relative to an existing symbol or a named file position ('after:<symbol>', 'before:<symbol>', 'after-imports', 'end-of-file', 'start-of-file').",
      inputSchema: {
        file: z.string().describe('Path to source file'),
        position: z
          .string()
          .describe(
            "'after:<symbol>', 'before:<symbol>', 'after-imports', 'end-of-file', 'start-of-file'",
          ),
        anchor_hash: z.string().optional().describe('Hash of anchor symbol from ctx_outline'),
        body: z.string().describe('Complete new symbol definition'),
        imports: z.array(z.string()).optional().describe('Import strings to inject/deduplicate'),
        dryRun: z.boolean().optional().describe('Return diff without writing'),
      },
    },
    async (input) => {
      const result = await insert(input as any);
      if (result.ok) {
        const parts = [`${result.linesChanged} lines added`];
        if (result.updatedOutline) parts.push('', '--- Updated outline ---', result.updatedOutline);
        return textResult(parts.join('\n'));
      }
      const parts = [`ERROR: ${result.error.code} — ${result.error.message}`];
      if (result.error.freshOutline) parts.push('', '--- Fresh outline ---', result.error.freshOutline);
      return textResult(parts.join('\n'));
    },
  );
}
