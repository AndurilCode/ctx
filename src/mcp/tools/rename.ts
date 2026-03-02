import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { rename } from '../../core/rename.js';
import { textResult } from './common.js';

export function registerRenameTool(server: McpServer): void {
  server.registerTool(
    'ctx_rename',
    {
      description:
        'Rename a symbol across its definition and all call sites. Atomic — all sites validated and written in one operation.',
      inputSchema: {
        file: z.string().describe('File containing the definition'),
        symbol: z.string().describe('Current symbol name'),
        hash: z.string().describe('Hash of the definition from ctx_outline'),
        to: z.string().describe('New symbol name'),
        scope: z
          .string()
          .optional()
          .describe('Glob to limit reference search (default: entire repo)'),
        dryRun: z.boolean().optional().describe('Return summary without writing'),
      },
    },
    async (input) => {
      const result = await rename(input as Parameters<typeof rename>[0]);
      if (result.ok) {
        return textResult(result.summary);
      }
      const parts = [`ERROR: ${result.error.code} — ${result.error.message}`];
      if (result.error.freshOutline)
        parts.push('', '--- Fresh outline ---', result.error.freshOutline);
      return textResult(parts.join('\n'));
    },
  );
}
