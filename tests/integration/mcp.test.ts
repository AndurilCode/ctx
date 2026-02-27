import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { compact } from '../../src/core/compact.js';
import { expand } from '../../src/core/expand.js';
import { verify } from '../../src/core/verify.js';
import { runDiffTool } from '../../src/mcp/tools/diff.js';
import { runExtractTool } from '../../src/mcp/tools/extract.js';
import { runPackTool } from '../../src/mcp/tools/pack.js';
import { runPruneLogTool } from '../../src/mcp/tools/prune-log.js';
import { runSectionsTool } from '../../src/mcp/tools/sections.js';
import { runStatsTool } from '../../src/mcp/tools/stats.js';
import { runSummarizeTool } from '../../src/mcp/tools/summarize.js';
import { runUnpackTool } from '../../src/mcp/tools/unpack.js';
import { runVerifyTool } from '../../src/mcp/tools/verify.js';
import { _resetForTesting } from '../../src/utils/summary-cache.js';

function textFromToolResult(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (!first || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Expected first MCP content item to be text.');
  }

  return first.text;
}

describe('mcp tools integration', () => {
  beforeEach(() => {
    const tmpPath = join(mkdtempSync(join(tmpdir(), 'ctx-mcp-test-')), 'cache.json');
    _resetForTesting(tmpPath);
  });

  afterEach(() => {
    _resetForTesting();
  });

  test('ctx_compact returns compacted markdown text', async () => {
    const markdown = '# Title\n\n- [ ] todo item\n';
    const result = await runPackTool({ markdown });
    const output = textFromToolResult(result);
    const expected = compact(markdown).output;

    expect(output).toBe(expected);
  });

  test('ctx_compact supports section elision options', async () => {
    const markdown = '# Intro\n\nhello\n\n# Keep\n\nvalue\n';
    const result = await runPackTool({ markdown, onlySections: ['keep'] });
    const compactText = textFromToolResult(result);
    const restored = expand(compactText);

    expect(restored).toContain('# Keep');
    expect(restored).not.toContain('# Intro');
  });

  test('ctx_expand restores markdown from compact text', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const compactText = compact(markdown).output;
    const result = await runUnpackTool({ compact: compactText });
    const output = textFromToolResult(result);
    const expected = expand(compactText);

    expect(output).toBe(expected);
  });

  test('ctx_metrics returns JSON stats payload', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const result = await runStatsTool({ markdown });
    const output = textFromToolResult(result);
    const parsed = JSON.parse(output) as { originalTokens: number; compactTokens: number };

    expect(parsed.originalTokens).toBeGreaterThan(0);
    expect(parsed.compactTokens).toBeGreaterThan(0);
  });

  test('ctx_sections returns headings and token counts', async () => {
    const markdown = '# Intro\n\nhello\n\n## Child\n\nworld\n';
    const result = await runSectionsTool({ markdown });
    const output = textFromToolResult(result);

    expect(output).toContain('# Intro');
    expect(output).toContain('## Child');
    expect(output).toMatch(/\(\d+ tokens\)/);
  });

  test('ctx_verify returns validation result', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const result = await runVerifyTool({ markdown });
    const output = textFromToolResult(result);
    const parsed = JSON.parse(output) as { valid: boolean };

    expect(parsed.valid).toBe(verify(markdown));
  });

  test('pack tool returns error for mutually exclusive section filters', async () => {
    const markdown = '# Intro\n\nhello\n\n# Keep\n\nvalue\n';

    await expect(
      runPackTool({
        markdown,
        onlySections: ['keep'],
        stripSections: ['intro'],
      }),
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
    const log = ['✓ test one', '✓ test two', '✗ test three', 'Tests: 2 passed, 1 failed'].join(
      '\n',
    );
    const result = await runPruneLogTool({ log, allowTokenExpansion: true });
    const output = textFromToolResult(result);
    const parsed = JSON.parse(output) as { output: string; summaryUsed: boolean };

    expect(parsed.output).toContain('✗ test three');
    expect(parsed.output).toContain('[tests pruned: 2 passing stripped, 1 failing kept]');
    expect(parsed.summaryUsed).toBe(false);
  });

  test('ctx_prune applies runtime profile defaults', async () => {
    const log = ['2026-02-25T10:00:00Z GET /users 200', '2026-02-25T10:00:01Z GET /users 500'].join(
      '\n',
    );
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
    const parsed = JSON.parse(textFromToolResult(result)) as {
      summaryUsed: boolean;
      summary?: string;
    };

    expect(parsed.summaryUsed).toBe(true);
    expect(parsed.summary).toBe('pruned summary');
  });

  describe('file path support', () => {
    test('ctx_compact reads from file when file param provided', async () => {
      const markdown = '# Title\n\nParagraph text.\n';
      const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runPackTool({ file: filePath });
      const output = textFromToolResult(result);
      const expected = compact(markdown).output;

      expect(output).toBe(expected);
    });

    test('ctx_metrics reads from file when file param provided', async () => {
      const markdown = '# Title\n\nParagraph text.\n';
      const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runStatsTool({ file: filePath });
      const output = textFromToolResult(result);
      const parsed = JSON.parse(output) as { originalTokens: number; compactTokens: number };

      expect(parsed.originalTokens).toBeGreaterThan(0);
      expect(parsed.compactTokens).toBeGreaterThan(0);
    });

    test('ctx_sections reads from file when file param provided', async () => {
      const markdown = '# Intro\n\nhello\n\n## Child\n\nworld\n';
      const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runSectionsTool({ file: filePath });
      const output = textFromToolResult(result);

      expect(output).toContain('# Intro');
      expect(output).toContain('## Child');
    });

    test('ctx_verify reads from file when file param provided', async () => {
      const markdown = '# Title\n\nParagraph text.\n';
      const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runVerifyTool({ file: filePath });
      const output = textFromToolResult(result);
      const parsed = JSON.parse(output) as { valid: boolean };

      expect(parsed.valid).toBe(verify(markdown));
    });

    test('ctx_changes reads from file when file param provided', async () => {
      const diff = [
        'diff --git a/src/app.ts b/src/app.ts',
        'index 1..2 100644',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ].join('\n');
      const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
      const filePath = join(dir, 'test.diff');
      await writeFile(filePath, diff);

      const result = await runDiffTool({ file: filePath });
      const output = textFromToolResult(result);

      expect(output).toContain('=== src/app.ts');
      expect(output).toContain('-old');
      expect(output).toContain('+new');
    });

    test('ctx_prune reads from file when file param provided', async () => {
      const log = ['2026-02-25T10:00:00Z info line', '2026-02-25T10:00:01Z info line'].join('\n');
      const dir = await mkdtemp(join(tmpdir(), 'ctx-test-'));
      const filePath = join(dir, 'test.log');
      await writeFile(filePath, log);

      const result = await runPruneLogTool({
        file: filePath,
        stripTimestamps: 'strip',
        allowTokenExpansion: true,
      });
      const output = textFromToolResult(result);
      const parsed = JSON.parse(output) as { output: string };

      expect(parsed.output).toContain('[timestamps stripped: iso]');
      expect(parsed.output).not.toContain('2026-02-25T10:00:01Z');
    });

    test('pack tool throws when neither markdown nor file provided', async () => {
      await expect(runPackTool({} as { markdown: string })).rejects.toThrow(/markdown.*file/i);
    });

    test('diff tool throws when neither diff nor file provided', async () => {
      await expect(runDiffTool({})).rejects.toThrow(/diff.*file/i);
    });

    test('prune-log tool throws when neither log nor file provided', async () => {
      await expect(runPruneLogTool({})).rejects.toThrow(/log.*file/i);
    });
  });

  test('ctx_extract truncates prose structures', async () => {
    const markdown = [
      '# Title',
      '',
      'This is a long paragraph with more than ten characters.',
      '',
      '- one',
      '- two',
      '- three',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '| 3 | 4 |',
      '',
    ].join('\n');

    const result = await runExtractTool({
      markdown,
      maxChars: 10,
      maxListItems: 1,
      maxTableRows: 1,
    });
    const output = textFromToolResult(result);

    expect(output).toContain('This is a ...');
    expect(output).toContain('... 2 more items');
    expect(output).toContain('... 1 more rows');
  });

  test('ctx_summarize delegates to MCP sampling', async () => {
    const markdown = '# Keep\n\nuseful details\n\n# Drop\n\nnoise\n';
    let prompt = '';

    const server = {
      server: {
        createMessage: async (request: { messages: Array<{ content: { text: string } }> }) => {
          prompt = request.messages[0]?.content.text ?? '';
          return {
            model: 'mock-model',
            role: 'assistant',
            content: { type: 'text', text: 'mock summary' },
          };
        },
      },
    } as unknown as McpServer;

    const result = await runSummarizeTool(server, {
      markdown,
      onlySections: ['keep'],
      maxTokens: 128,
    });
    const output = textFromToolResult(result);

    expect(output).toBe('mock summary');
    expect(prompt).toContain('# Keep');
    expect(prompt).not.toContain('# Drop');
  });

  test('ctx_summarize falls back to extract when sampling is unavailable', async () => {
    const markdown = '# Keep\n\nuseful details\n\n# Drop\n\nnoise\n';
    const server = {
      server: {
        createMessage: async () => {
          throw new Error('MCP error -32601: Method not found');
        },
      },
    } as unknown as McpServer;

    const result = await runSummarizeTool(server, {
      markdown,
      onlySections: ['keep'],
    });
    const output = textFromToolResult(result);

    expect(output).toContain('[fallback=extract]');
    expect(output).toContain('# Keep');
    expect(output).not.toContain('# Drop');
  });

  describe('ctx_summarize caching', () => {
    test('second call with identical content skips sampling', async () => {
      const markdown = '# Topic\n\ncontent\n';
      let calls = 0;
      const server = {
        server: {
          createMessage: async () => {
            calls++;
            return { model: 'mock', role: 'assistant', content: { type: 'text', text: 'summary' } };
          },
        },
      } as unknown as McpServer;

      await runSummarizeTool(server, { markdown });
      await runSummarizeTool(server, { markdown });

      expect(calls).toBe(1);
    });

    test('second call returns the cached summary', async () => {
      const markdown = '# Topic\n\ncontent\n';
      const server = {
        server: {
          createMessage: async () => ({
            model: 'mock',
            role: 'assistant',
            content: { type: 'text', text: 'cached summary' },
          }),
        },
      } as unknown as McpServer;

      await runSummarizeTool(server, { markdown });
      const result = await runSummarizeTool(server, { markdown });

      expect(textFromToolResult(result)).toBe('cached summary');
    });

    test('changed content calls sampling again and replaces the cached summary', async () => {
      let callCount = 0;
      const server = {
        server: {
          createMessage: async () => {
            callCount++;
            return {
              model: 'mock',
              role: 'assistant',
              content: { type: 'text', text: `summary-${callCount}` },
            };
          },
        },
      } as unknown as McpServer;

      await runSummarizeTool(server, { markdown: '# Topic\n\noriginal\n' });
      const result = await runSummarizeTool(server, { markdown: '# Topic\n\nupdated\n' });

      expect(callCount).toBe(2);
      expect(textFromToolResult(result)).toBe('summary-2');
    });

    test('fallback result is cached and avoids a second sampling attempt', async () => {
      let calls = 0;
      const server = {
        server: {
          createMessage: async () => {
            calls++;
            throw new Error('Method not found');
          },
        },
      } as unknown as McpServer;

      const markdown = '# Topic\n\ncontent\n';
      await runSummarizeTool(server, { markdown });
      const result = await runSummarizeTool(server, { markdown });

      expect(calls).toBe(1);
      expect(textFromToolResult(result)).toContain('[fallback=extract]');
    });
  });
});
