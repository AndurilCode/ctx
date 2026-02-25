import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerExtractTool } from './extract.js';
import { registerPackTool } from './pack.js';
import { registerSectionsTool } from './sections.js';
import { registerStatsTool } from './stats.js';
import { registerSummarizeTool } from './summarize.js';
import { registerUnpackTool } from './unpack.js';
import { registerVerifyTool } from './verify.js';

export function registerCompactMdTools(server: McpServer): void {
  registerPackTool(server);
  registerExtractTool(server);
  registerUnpackTool(server);
  registerStatsTool(server);
  registerSectionsTool(server);
  registerSummarizeTool(server);
  registerVerifyTool(server);
}
