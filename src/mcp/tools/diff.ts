import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { compactDiff } from '../../core/compact-diff.js';
import { textResult } from './common.js';
import { diffInputSchema } from './options.js';

export interface DiffToolInput {
  diff?: string;
  file?: string;
  context?: number;
  compactHeaders?: boolean;
  changesOnly?: boolean;
}

export async function runDiffTool(input: DiffToolInput): Promise<CallToolResult> {
  const diff = await resolveDiff(input);
  const output = compactDiff(diff, {
    context: input.context,
    compactHeaders: input.compactHeaders,
    changesOnly: input.changesOnly,
  });
  return textResult(output);
}

export function registerDiffTool(server: McpServer): void {
  server.registerTool(
    'compact_md_diff',
    {
      description:
        'Compress unified git diff text. Supports header compaction, reduced context, or changes-only mode.',
      inputSchema: diffInputSchema,
    },
    async (input) => runDiffTool(input),
  );
}

async function resolveDiff(input: DiffToolInput): Promise<string> {
  if (input.file) {
    return readFile(input.file, 'utf8');
  }

  if (input.diff) {
    return input.diff;
  }

  throw new Error('Either diff or file must be provided.');
}
