import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { verifyChanges } from '../../core/change-verify.js';
import { jsonResult } from './common.js';

export interface ChangeVerifyToolInput {
  file?: string;
  symbol?: string;
  since?: string;
  diff?: boolean;
  exec?: boolean;
  testCommand?: string;
  typeCommand?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export async function runChangeVerifyTool(input: ChangeVerifyToolInput): Promise<CallToolResult> {
  const result = await verifyChanges(input);
  return jsonResult(result);
}

export function registerChangeVerifyTool(server: McpServer): void {
  server.registerTool(
    'ctx_verify',
    {
      description:
        'Targeted post-change verification. Plan mode is default; use exec=true to run checks/tests and return pruned output.',
      inputSchema: {
        file: z.string().optional().describe('Changed source file path'),
        symbol: z.string().optional().describe('Specific changed symbol'),
        since: z.string().optional().describe('Previous symbol hash for change comparison'),
        diff: z.boolean().optional().describe('Analyze files in current working tree diff'),
        exec: z.boolean().optional().describe('Execute the verification plan (default: false)'),
        testCommand: z.string().optional().describe('Override test command'),
        typeCommand: z.string().optional().describe('Override type-check command'),
        maxTokens: z.number().int().min(100).optional().describe('Output token budget (reserved)'),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .optional()
          .describe('Timeout per command in exec mode (default: 30000)'),
      },
    },
    async (input) => runChangeVerifyTool(input),
  );
}
