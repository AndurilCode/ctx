import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { compact } from '../../core/compact.js';
import { computeStats } from '../../utils/stats.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { jsonResult, resolveMarkdown } from './common.js';
import { type PackLikeToolInput, toCompactOptions } from './options.js';

export interface StatsToolInput extends PackLikeToolInput {
  markdown?: string;
  file?: string;
}

export async function runStatsTool(input: StatsToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const options = toCompactOptions(input);
  const result = compact(markdown, { ...options, stats: true });
  if (!result.stats) {
    throw new Error('Expected stats payload from compact().');
  }

  const tokenCounter = await createTokenCounter();
  const stats = computeStats(markdown, result.output, result.stats.stageStats, tokenCounter);
  return jsonResult(stats);
}

export function registerStatsTool(server: McpServer): void {
  server.registerTool(
    'compact_md_stats',
    {
      description:
        'Calculate compression stats for markdown input. Pass either markdown (string) or file (absolute path).',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
        dedup: z.boolean().optional(),
        semantic: z.boolean().optional(),
        keepComments: z.boolean().optional(),
        onlySections: z.array(z.string()).optional(),
        stripSections: z.array(z.string()).optional(),
        unwrapLines: z.boolean().optional(),
        tableDelimiter: z.string().optional(),
        versionMarker: z.boolean().optional(),
      },
    },
    async (input) => runStatsTool(input),
  );
}
