import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { createHarnessState, decide } from '../../core/harness/index.js';
import { jsonResult } from './common.js';

export interface HarnessDecideInput {
  tool: string;
  args: Record<string, unknown>;
  fileTokens?: number;
  contextWindow?: number;
  taskDescription?: string;
}

export async function runHarnessDecideTool(input: HarnessDecideInput): Promise<CallToolResult> {
  const state = createHarnessState({ contextWindow: input.contextWindow ?? 200_000 });
  const fileTokens = new Map<string, number>();
  const file = input.args.file as string | undefined;
  if (file && input.fileTokens) {
    fileTokens.set(file, input.fileTokens);
  }

  const decision = await decide(
    { tool: input.tool, args: input.args },
    state,
    { fileTokens, mentionedSymbols: [], taskDescription: input.taskDescription },
  );

  return jsonResult(decision);
}

export function registerHarnessTool(server: McpServer): void {
  server.registerTool(
    'ctx_harness_decide',
    {
      description:
        'Evaluate a tool call against the context harness decision engine. Returns allow, rewrite, or warn with optimized alternative suggestions.',
      inputSchema: {
        tool: z.string().describe('The tool being called (read, grep, edit, etc.)'),
        args: z.record(z.unknown()).describe('The tool arguments as key-value pairs'),
        fileTokens: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Estimated token count of the target file'),
        contextWindow: z
          .number()
          .int()
          .min(1000)
          .optional()
          .describe('Total context window size in tokens (default: 200000)'),
        taskDescription: z
          .string()
          .optional()
          .describe('Description of the current task for better decision-making'),
      },
    },
    async (input) => runHarnessDecideTool(input as HarnessDecideInput),
  );
}
