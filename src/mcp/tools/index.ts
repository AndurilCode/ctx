import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerContextTool } from './context.js';
import { registerDiffTool } from './diff.js';
import { registerExtractTool } from './extract.js';
import { registerOutlineTool } from './outline.js';
import { registerPackTool } from './pack.js';
import { registerPruneLogTool } from './prune-log.js';
import { registerReadTool } from './read.js';
import { registerSearchSectionsTool } from './search-sections.js';
import { registerSectionsTool } from './sections.js';
import { registerStatsTool } from './stats.js';
import { registerSummarizeBatchTool } from './summarize-batch.js';
import { registerSummarizeTool } from './summarize.js';
import { registerTokenCountTool } from './token-count.js';
import { registerUnpackTool } from './unpack.js';
import { registerTreeTool } from './tree.js';
import { registerVerifyTool } from './verify.js';

export function registerCompactMdTools(server: McpServer): void {
  registerDiffTool(server);
  registerOutlineTool(server);
  registerPruneLogTool(server);
  registerPackTool(server);
  registerExtractTool(server);
  registerUnpackTool(server);
  registerStatsTool(server);
  registerSectionsTool(server);
  registerSummarizeTool(server);
  registerSummarizeBatchTool(server);
  registerSearchSectionsTool(server);
  registerTokenCountTool(server);
  registerTreeTool(server);
  registerVerifyTool(server);
  registerReadTool(server);
  registerContextTool(server);
}
