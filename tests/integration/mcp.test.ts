import { describe, expect, test } from 'bun:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { compact } from '../../src/core/compact.js';
import { expand } from '../../src/core/expand.js';
import { runDiffTool } from '../../src/mcp/tools/diff.js';
import { runExtractTool } from '../../src/mcp/tools/extract.js';
import { runPackTool } from '../../src/mcp/tools/pack.js';
import { runPruneLogTool } from '../../src/mcp/tools/prune-log.js';
import { runSectionsTool } from '../../src/mcp/tools/sections.js';
import { runUnpackTool } from '../../src/mcp/tools/unpack.js';

function textFromToolResult(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (!first || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Expected first MCP content item to be text.');
  }
  return first.text;
}

describe('mcp tools integration', () => {
  test('ctx_compact returns compacted markdown text', async () => {
    const markdown = '# Title\n\n- [ ] todo item\n';
    const result = await runPackTool({ markdown });
    expect(textFromToolResult(result)).toBe(compact(markdown).output);
  });

  test('ctx_compact supports section elision options', async () => {
    const markdown = '# Intro\n\nhello\n\n# Keep\n\nvalue\n';
    const result = await runPackTool({ markdown, onlySections: ['keep'] });
    const restored = expand(textFromToolResult(result));
    expect(restored).toContain('# Keep');
    expect(restored).not.toContain('# Intro');
  });

  test('ctx_expand restores markdown from compact text', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const compactText = compact(markdown).output;
    const result = await runUnpackTool({ compact: compactText });
    expect(textFromToolResult(result)).toBe(expand(compactText));
  });

  test('ctx_sections returns headings and token counts', async () => {
    const markdown = '# Intro\n\nhello\n\n## Child\n\nworld\n';
    const result = await runSectionsTool({ markdown });
    const output = textFromToolResult(result);
    expect(output).toContain('# Intro');
    expect(output).toContain('## Child');
    expect(output).toMatch(/\(\d+ tokens\)/);
  });

  test('pack tool returns error for mutually exclusive section filters', async () => {
    const markdown = '# Intro\n\nhello\n\n# Keep\n\nvalue\n';
    await expect(
      runPackTool({ markdown, onlySections: ['keep'], stripSections: ['intro'] }),
    ).rejects.toThrow(/mutually exclusive/i);
  });

  test('ctx_changes compacts unified diff input', async () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      'index 1..2 100644',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,3 +1,3 @@ function run() {',
      ' const a = 1;',
      '-const oldFlag = true;',
      '+const newFlag = true;',
      ' return a;',
    ].join('\n');
    const result = await runDiffTool({ diff });
    const output = textFromToolResult(result);
    expect(output).toContain('=== src/app.ts');
    expect(output).not.toContain('index 1..2');
    expect(output).toContain('-const oldFlag = true;');
    expect(output).toContain('+const newFlag = true;');
  });

  test('ctx_prune prunes noisy logs', async () => {
    const log = ['✓ test one', '✓ test two', '✗ test three', 'Tests: 2 passed, 1 failed'].join('\n');
    const result = await runPruneLogTool({ log, allowTokenExpansion: true });
    const parsed = JSON.parse(textFromToolResult(result)) as { output: string; summaryUsed: boolean };
    expect(parsed.output).toContain('✗ test three');
    expect(parsed.output).toContain('[tests pruned: 2 passing stripped, 1 failing kept]');
    expect(parsed.summaryUsed).toBe(false);
  });

  test('ctx_prune applies runtime profile defaults', async () => {
    const log = ['2026-02-25T10:00:00Z GET /users 200', '2026-02-25T10:00:01Z GET /users 500'].join('\n');
    const result = await runPruneLogTool({ log, profile: 'runtime' });
    const parsed = JSON.parse(textFromToolResult(result)) as { output: string };
    expect(parsed.output).toContain('[timestamps stripped: iso]');
    expect(parsed.output).not.toContain('2026-02-25T10:00:01Z');
  });

  test('ctx_prune applies lint profile defaults', async () => {
    const log = [
      '$ biome check .',
      './src/a.ts format',
      '',
      '  × Formatter would have printed the following content:',
      '',
      '    10 10 │ a',
      '    11 11 │ b',
      '',
    ].join('\n');
    const result = await runPruneLogTool({ log, profile: 'lint' });
    const parsed = JSON.parse(textFromToolResult(result)) as { output: string };
    expect(parsed.output).toContain('[diagnostic');
    expect(parsed.output).not.toContain('10 10 │ a');
  });

  test('ctx_prune summarizes when over threshold and sampling enabled', async () => {
    const server = {
      server: {
        createMessage: async () => ({
          model: 'mock',
          role: 'assistant',
          content: { type: 'text', text: 'pruned summary' },
        }),
      },
    } as unknown as McpServer;
    const log = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
    const result = await runPruneLogTool(
      { log, thresholdTokens: 1, summarizeIfOverThreshold: true, maxSummaryTokens: 128 },
      server,
    );
    const parsed = JSON.parse(textFromToolResult(result)) as { summaryUsed: boolean; summary?: string };
    expect(parsed.summaryUsed).toBe(true);
    expect(parsed.summary).toBe('pruned summary');
  });

  test('ctx_extract truncates prose structures', async () => {
    const markdown = [
      '# Title', '', 'This is a long paragraph with more than ten characters.', '',
      '- one', '- two', '- three', '',
      '| A | B |', '|---|---|', '| 1 | 2 |', '| 3 | 4 |', '',
    ].join('\n');
    const result = await runExtractTool({ markdown, maxChars: 10, maxListItems: 1, maxTableRows: 1 });
    const output = textFromToolResult(result);
    expect(output).toContain('This is a ...');
    expect(output).toContain('... 2 more items');
    expect(output).toContain('... 1 more rows');
  });
});
