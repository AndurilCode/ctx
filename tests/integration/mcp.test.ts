import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { compact } from '../../src/core/compact.js';
import { expand } from '../../src/core/expand.js';
import { verify } from '../../src/core/verify.js';
import { runExtractTool } from '../../src/mcp/tools/extract.js';
import { runPackTool } from '../../src/mcp/tools/pack.js';
import { runSectionsTool } from '../../src/mcp/tools/sections.js';
import { runStatsTool } from '../../src/mcp/tools/stats.js';
import { runSummarizeTool } from '../../src/mcp/tools/summarize.js';
import { runUnpackTool } from '../../src/mcp/tools/unpack.js';
import { runVerifyTool } from '../../src/mcp/tools/verify.js';

function textFromToolResult(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (!first || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Expected first MCP content item to be text.');
  }

  return first.text;
}

describe('mcp tools integration', () => {
  test('compact_md_pack returns compacted markdown text', async () => {
    const markdown = '# Title\n\n- [ ] todo item\n';
    const result = await runPackTool({ markdown });
    const output = textFromToolResult(result);
    const expected = compact(markdown).output;

    expect(output).toBe(expected);
  });

  test('compact_md_pack supports section elision options', async () => {
    const markdown = '# Intro\n\nhello\n\n# Keep\n\nvalue\n';
    const result = await runPackTool({ markdown, onlySections: ['keep'] });
    const compactText = textFromToolResult(result);
    const restored = expand(compactText);

    expect(restored).toContain('# Keep');
    expect(restored).not.toContain('# Intro');
  });

  test('compact_md_unpack restores markdown from compact text', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const compactText = compact(markdown).output;
    const result = await runUnpackTool({ compact: compactText });
    const output = textFromToolResult(result);
    const expected = expand(compactText);

    expect(output).toBe(expected);
  });

  test('compact_md_stats returns JSON stats payload', async () => {
    const markdown = '# Title\n\nParagraph text.\n';
    const result = await runStatsTool({ markdown });
    const output = textFromToolResult(result);
    const parsed = JSON.parse(output) as { originalTokens: number; compactTokens: number };

    expect(parsed.originalTokens).toBeGreaterThan(0);
    expect(parsed.compactTokens).toBeGreaterThan(0);
  });

  test('compact_md_sections returns headings and token counts', async () => {
    const markdown = '# Intro\n\nhello\n\n## Child\n\nworld\n';
    const result = await runSectionsTool({ markdown });
    const output = textFromToolResult(result);

    expect(output).toContain('# Intro');
    expect(output).toContain('## Child');
    expect(output).toMatch(/\(\d+ tokens\)/);
  });

  test('compact_md_verify returns validation result', async () => {
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

  describe('file path support', () => {
    test('compact_md_pack reads from file when file param provided', async () => {
      const markdown = '# Title\n\nParagraph text.\n';
      const dir = await mkdtemp(join(tmpdir(), 'compact-md-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runPackTool({ file: filePath });
      const output = textFromToolResult(result);
      const expected = compact(markdown).output;

      expect(output).toBe(expected);
    });

    test('compact_md_stats reads from file when file param provided', async () => {
      const markdown = '# Title\n\nParagraph text.\n';
      const dir = await mkdtemp(join(tmpdir(), 'compact-md-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runStatsTool({ file: filePath });
      const output = textFromToolResult(result);
      const parsed = JSON.parse(output) as { originalTokens: number; compactTokens: number };

      expect(parsed.originalTokens).toBeGreaterThan(0);
      expect(parsed.compactTokens).toBeGreaterThan(0);
    });

    test('compact_md_sections reads from file when file param provided', async () => {
      const markdown = '# Intro\n\nhello\n\n## Child\n\nworld\n';
      const dir = await mkdtemp(join(tmpdir(), 'compact-md-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runSectionsTool({ file: filePath });
      const output = textFromToolResult(result);

      expect(output).toContain('# Intro');
      expect(output).toContain('## Child');
    });

    test('compact_md_verify reads from file when file param provided', async () => {
      const markdown = '# Title\n\nParagraph text.\n';
      const dir = await mkdtemp(join(tmpdir(), 'compact-md-test-'));
      const filePath = join(dir, 'test.md');
      await writeFile(filePath, markdown);

      const result = await runVerifyTool({ file: filePath });
      const output = textFromToolResult(result);
      const parsed = JSON.parse(output) as { valid: boolean };

      expect(parsed.valid).toBe(verify(markdown));
    });

    test('pack tool throws when neither markdown nor file provided', async () => {
      await expect(runPackTool({} as { markdown: string })).rejects.toThrow(/markdown.*file/i);
    });
  });

  test('compact_md_extract truncates prose structures', async () => {
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

  test('compact_md_summarize delegates to MCP sampling', async () => {
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

  test('compact_md_summarize falls back to extract when sampling is unavailable', async () => {
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
});
