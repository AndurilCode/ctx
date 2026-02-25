import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { relevance } from '../../core/relevance.js';
import { jsonResult } from './common.js';

export interface RelevanceToolInput {
  query: string;
  files: string[];
  maxResults?: number;
}

export async function runRelevanceTool(input: RelevanceToolInput): Promise<CallToolResult> {
  const result = await relevance(input);
  return jsonResult(result);
}

export function registerRelevanceTool(server: McpServer): void {
  server.registerTool(
    'compact_md_relevance',
    {
      description:
        'Rank files by structural relevance to a query without calling an LLM. Uses filename, symbol names, headings, and content matches. Use this to decide which files to read before committing tokens.',
      inputSchema: {
        query: z.string().describe('Natural language task description or keyword(s)'),
        files: z.array(z.string()).describe('File paths to rank'),
        maxResults: z.number().int().min(1).optional().describe('Maximum results to return (default: 10)'),
      },
    },
    async (input) => runRelevanceTool(input),
  );
}
