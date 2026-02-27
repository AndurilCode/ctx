import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { review } from '../../core/review.js';
import { jsonResult } from './common.js';

export interface ReviewToolInput {
  query: string;
  path?: string;
  glob?: string;
  profile?: 'code' | 'full' | 'docs';
  maxResults?: number;
  pass1Tokens?: number;
  pass2Tokens?: number;
  maxPass2Files?: number;
  riskTerms?: string[];
  evidence?: boolean;
  changedFiles?: string[];
  diffBase?: string;
  cluster?: boolean;
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
        'Run two-pass token-aware code review triage with token accounting. Use for repo-level risk surfacing; do not use as final truth for one file (follow with compact_md_read or compact_md_outline).',
      inputSchema: {
        query: z.string().describe('Task description or review query'),
        path: z.string().optional().describe('Root directory to search (default: cwd)'),
        glob: z.string().optional().describe('File glob pattern (default: **/*.{ts,tsx,js,jsx})'),
        profile: z.enum(['code', 'full', 'docs']).optional().describe('Scope preset: code (default), full, or docs'),
        maxResults: z.number().int().min(1).optional().describe('Max ranked files to review (default: 10)'),
        pass1Tokens: z.number().int().min(1).optional().describe('Pass-1 token budget per file (default: 600)'),
        pass2Tokens: z.number().int().min(1).optional().describe('Pass-2 token budget per file (default: 2000)'),
        maxPass2Files: z.number().int().min(0).optional().describe('Max files to escalate to pass-2 (default: 3)'),
        riskTerms: z.array(z.string()).optional().describe('Override risk terms used for pass-2 escalation'),
        evidence: z.boolean().optional().describe('Include line-anchored evidence snippets for flagged files (default: false)'),
        changedFiles: z.array(z.string()).optional().describe('File paths to boost in ranking (e.g. from active diff)'),
        diffBase: z.string().optional().describe('Git ref to derive changed files from (e.g. "HEAD~1", "main")'),
        cluster: z.boolean().optional().describe('Group flagged files by matched risk term (default: false)'),
      },
    },
    async (input) => runReviewTool(input),
  );
}
