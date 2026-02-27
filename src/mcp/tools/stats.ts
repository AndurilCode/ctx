import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { compact } from '../../core/compact.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { computeStats } from '../../utils/stats.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { jsonResult, resolveMarkdown } from './common.js';
import { type PackLikeToolInput, packLikeInputSchema, toCompactOptions } from './options.js';

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
  return jsonResult({ ...stats, frontmatter: parseFrontmatter(markdown) });
}

export function registerStatsTool(server: McpServer): void {
  server.registerTool(
    'ctx_metrics',
    {
      description:
        'Compute compression and token metrics for markdown input. Use to measure savings; do not use to generate compact output (use ctx_compact).',
      inputSchema: packLikeInputSchema,
    },
    async (input) => runStatsTool(input),
  );
}
