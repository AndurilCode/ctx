import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { patch } from '../../core/patch.js';
import { textResult } from './common.js';

const lineEditSchema = z.object({
  hash: z.string().describe('2-char content hash of the line'),
  replace: z.string().optional().describe('Replace the line with this content'),
  after: z.string().optional().describe('Insert this content after the matched line'),
  before: z.string().optional().describe('Insert this content before the matched line'),
  delete: z.boolean().optional().describe('Delete the matched line'),
});

const singlePatchSchema = z.object({
  symbol: z.string().describe('Symbol name from ctx_outline'),
  hash: z.string().describe('Content hash from ctx_outline'),
  body: z.string().optional().describe('Complete new implementation (full-body mode)'),
  lines: z.array(lineEditSchema).optional().describe('Line-hash edits within the symbol'),
  imports: z.array(z.string()).optional().describe('Import strings to inject/deduplicate'),
});

export function registerPatchTool(server: McpServer): void {
  server.registerTool(
    'ctx_patch',
    {
      description:
        'Replace a named symbol (function, class, type, variable) in a source file. Hash must match the value from ctx_outline to prevent stale edits. Supports single-symbol, multi-symbol atomic batch, line-hash intra-symbol, and hashline fallback modes.',
      inputSchema: {
        file: z.string().describe('Path to source file'),
        symbol: z.string().optional().describe('Symbol name (single-symbol mode)'),
        hash: z.string().optional().describe('Content hash from ctx_outline (single-symbol mode)'),
        body: z.string().optional().describe('Complete new implementation (full-body mode)'),
        lines: z
          .array(lineEditSchema)
          .optional()
          .describe('Line-hash edits (line-hash or hashline fallback mode)'),
        imports: z.array(z.string()).optional().describe('Import strings to inject/deduplicate'),
        patches: z.array(singlePatchSchema).optional().describe('Batch of patches (multi-symbol mode)'),
        language: z.string().optional().describe('Force language detection'),
        dryRun: z.boolean().optional().describe('Return diff without writing'),
      },
    },
    async (input) => {
      const result = await patch(input as any);
      if (result.ok) {
        const parts = [`${result.linesChanged} lines changed`];
        if (result.diff) parts.push('', result.diff);
        if (result.updatedOutline) parts.push('', '--- Updated outline ---', result.updatedOutline);
        return textResult(parts.join('\n'));
      }
      const parts = [`ERROR: ${result.error.code} — ${result.error.message}`];
      if (result.error.freshOutline) parts.push('', '--- Fresh outline ---', result.error.freshOutline);
      if (result.error.disambiguation) {
        parts.push('', 'Disambiguation:');
        for (const d of result.error.disambiguation) {
          parts.push(`  ${d.name}  hash:${d.hash}  L${d.startLine}-L${d.endLine}`);
        }
      }
      return textResult(parts.join('\n'));
    },
  );
}
