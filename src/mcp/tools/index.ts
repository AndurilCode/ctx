import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPackTool } from './pack.js';
import { registerSectionsTool } from './sections.js';
import { registerStatsTool } from './stats.js';
import { registerUnpackTool } from './unpack.js';
import { registerVerifyTool } from './verify.js';

export function registerCompactMdTools(server: McpServer): void {
  registerPackTool(server);
  registerUnpackTool(server);
  registerStatsTool(server);
  registerSectionsTool(server);
  registerVerifyTool(server);
}
