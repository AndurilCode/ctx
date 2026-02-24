import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCompactMdTools } from './tools/index.js';

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'compact-md',
    version: '0.1.0',
  });

  registerCompactMdTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`compact-md-mcp startup failed: ${message}\n`);
  process.exitCode = 1;
});
