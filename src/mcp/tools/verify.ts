import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  type RoundtripVerifyToolInput,
  registerRoundtripVerifyTool,
  runRoundtripVerifyTool,
} from './roundtrip-verify.js';

export type VerifyToolInput = RoundtripVerifyToolInput;

/**
 * @deprecated Use runRoundtripVerifyTool from mcp/tools/roundtrip-verify.ts.
 */
export async function runVerifyTool(input: VerifyToolInput): Promise<CallToolResult> {
  return runRoundtripVerifyTool(input);
}

/**
 * @deprecated Use registerRoundtripVerifyTool from mcp/tools/roundtrip-verify.ts.
 */
export function registerVerifyTool(server: McpServer): void {
  registerRoundtripVerifyTool(server);
}
