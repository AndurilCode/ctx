import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAutoContextTool } from './auto-context.js';
import { registerContextTool } from './context.js';
import { registerDiffTool } from './diff.js';
import { registerExtractTool } from './extract.js';
import { registerImportsTool } from './imports.js';
import { registerSymbolsTool } from './symbols.js';
import { registerOutlineTool } from './outline.js';
import { registerPackTool } from './pack.js';
import { registerPruneLogTool } from './prune-log.js';
import { registerReadTool } from './read.js';
import { registerRelevanceTool } from './relevance.js';
import { registerReviewTool } from './review.js';
import { registerSectionsTool } from './sections.js';
import { registerSummarizeBatchTool } from './summarize-batch.js';
import { registerSummarizeTool } from './summarize.js';
import { registerUnpackTool } from './unpack.js';
import { registerTreeTool } from './tree.js';

export function registerCompactMdTools(server: McpServer): void {
  registerDiffTool(server);
  registerOutlineTool(server);
  registerPruneLogTool(server);
  registerPackTool(server);
  registerExtractTool(server);
  registerUnpackTool(server);
  registerSectionsTool(server);
  registerSummarizeTool(server);
  registerSummarizeBatchTool(server);
  registerTreeTool(server);
  registerReadTool(server);
  registerRelevanceTool(server);
  registerReviewTool(server);
  registerContextTool(server);
  registerAutoContextTool(server);
  registerImportsTool(server);
  registerSymbolsTool(server);
}
