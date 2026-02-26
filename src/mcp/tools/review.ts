import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { review } from '../../core/review.js';
import { jsonResult } from './common.js';

export interface ReviewToolInput {
  query: string;
  path?: string;
  glob?: string;
  maxResults?: number;
  pass1Tokens?: number;
  pass2Tokens?: number;
  maxPass2Files?: number;
  riskTerms?: string[];
}

export async function runReviewTool(input: ReviewToolInput): Promise<CallToolResult> {
  const result = await review(input);
  return jsonResult(result);
}

export function registerReviewTool(server: McpServer): void {
  server.registerTool(
    'compact_md_review',
    {
      description:
        'Run a two-pass token-aware review workflow: rank relevant files, read all with a compact pass, and escalate only flagged files for deeper pass.',
      inputSchema: {
        query: z.string().describe('Task description or review query'),
        path: z.string().optional().describe('Root directory to search (default: cwd)'),
        glob: z.string().optional().describe('File glob pattern (default: **/*.{ts,tsx,js,jsx})'),
        maxResults: z.number().int().min(1).optional().describe('Max ranked files to review (default: 10)'),
        pass1Tokens: z.number().int().min(1).optional().describe('Pass-1 token budget per file (default: 600)'),
        pass2Tokens: z.number().int().min(1).optional().describe('Pass-2 token budget per file (default: 2000)'),
        maxPass2Files: z.number().int().min(0).optional().describe('Max files to escalate to pass-2 (default: 3)'),
        riskTerms: z.array(z.string()).optional().describe('Override risk terms used for pass-2 escalation'),
      },
    },
    async (input) => runReviewTool(input),
  );
}
