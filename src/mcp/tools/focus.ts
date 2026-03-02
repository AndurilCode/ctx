import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { focus } from '../../core/focus.js';
import type { FocusSection } from '../../types/focus.js';
import { jsonResult } from './common.js';

export interface FocusToolInput {
  file: string;
  symbol: string;
  hash?: string;
  maxTokens?: number;
  depth?: number;
  include?: FocusSection[];
}

export async function runFocusTool(input: FocusToolInput): Promise<CallToolResult> {
  const result = await focus(input);
  return jsonResult(result);
}

export function registerFocusTool(server: McpServer): void {
  server.registerTool(
    'ctx_focus',
    {
      description:
        'Assemble full symbol context in one call: body, callers, dependencies, types, tests, and local conventions.',
      inputSchema: {
        file: z.string().describe('Path to source file'),
        symbol: z.string().describe('Symbol name from ctx_outline'),
        hash: z.string().optional().describe('Optional symbol hash for freshness validation'),
        maxTokens: z.number().int().min(100).optional().describe('Total token budget (default: 2000)'),
        depth: z.number().int().min(1).optional().describe('Caller/dependency trace depth (default: 1)'),
        include: z
          .array(z.enum(['body', 'callers', 'deps', 'types', 'tests', 'conventions']))
          .optional()
          .describe('Sections to include (default: all)'),
      },
    },
    async (input) => runFocusTool(input),
  );
}
