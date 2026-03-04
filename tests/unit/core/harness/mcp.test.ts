import { describe, expect, test } from 'bun:test';
import { runHarnessDecideTool } from '../../../../src/mcp/tools/harness.js';

describe('ctx_harness_decide MCP tool', () => {
  test('returns rewrite decision for large file read', async () => {
    const result = await runHarnessDecideTool({
      tool: 'read',
      args: { file: 'big.ts' },
      fileTokens: 5000,
      contextWindow: 200_000,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('rewrite');
  });

  test('returns allow decision for small file read', async () => {
    const result = await runHarnessDecideTool({
      tool: 'read',
      args: { file: 'tiny.ts' },
      fileTokens: 50,
      contextWindow: 200_000,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('allow');
  });

  test('returns rewrite for unscoped grep', async () => {
    const result = await runHarnessDecideTool({
      tool: 'grep',
      args: { pattern: 'TODO' },
      contextWindow: 200_000,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('rewrite');
  });

  test('uses default context window when not specified', async () => {
    const result = await runHarnessDecideTool({
      tool: 'read',
      args: { file: 'tiny.ts' },
      fileTokens: 50,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('allow');
  });
});
