import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDiffTool } from './diff.js';
import { registerExtractTool } from './extract.js';
import { registerPackTool } from './pack.js';
import { registerPruneLogTool } from './prune-log.js';
import { registerSearchSectionsTool } from './search-sections.js';
import { registerSectionsTool } from './sections.js';
import { registerStatsTool } from './stats.js';
import { registerSummarizeBatchTool } from './summarize-batch.js';
import { registerSummarizeTool } from './summarize.js';
import { registerUnpackTool } from './unpack.js';
import { registerVerifyTool } from './verify.js';

export function registerCompactMdTools(server: McpServer): void {
  registerDiffTool(server);
  registerPruneLogTool(server);
  registerPackTool(server);
  registerExtractTool(server);
  registerUnpackTool(server);
  registerStatsTool(server);
  registerSectionsTool(server);
  registerSummarizeTool(server);
  registerSummarizeBatchTool(server);
  registerSearchSectionsTool(server);
  registerVerifyTool(server);
}
