import { describe, expect, test } from 'bun:test';
import { runExtractTool } from '../../src/mcp/tools/extract.js';
import { runPackTool } from '../../src/mcp/tools/pack.js';
import { runSectionsTool } from '../../src/mcp/tools/sections.js';
import { runStatsTool } from '../../src/mcp/tools/stats.js';
import { runSummarizeTool } from '../../src/mcp/tools/summarize.js';
import { runVerifyTool } from '../../src/mcp/tools/verify.js';

const markdownWithFrontmatter = [
  '---',
  'title: Compact Docs',
  'count: 3',
  'enabled: true',
  'tags: [alpha, beta]',
  'empty: null',
  '---',
  '# Intro',
  '',
  'Body',
  '',
].join('\n');

function frontmatterFromTextResult(result: {
  content: Array<{ type: string; text?: string }>;
}): Record<string, unknown> {
  const second = result.content[1];
  if (!second || second.type !== 'text' || typeof second.text !== 'string') {
    throw new Error('Expected second MCP content item with frontmatter JSON.');
  }

  const parsed = JSON.parse(second.text) as { frontmatter?: Record<string, unknown> };
  return parsed.frontmatter ?? {};
}

function textFromToolResult(result: { content: Array<{ type: string; text?: string }> }): string {
  const first = result.content[0];
  if (!first || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Expected first MCP content item to be text.');
  }

  return first.text;
}

describe('mcp tools frontmatter', () => {
  test('text tools always include parsed frontmatter as second content item', async () => {
    const pack = await runPackTool({ markdown: markdownWithFrontmatter });
    const sections = await runSectionsTool({ markdown: markdownWithFrontmatter });
    const extract = await runExtractTool({ markdown: markdownWithFrontmatter });

    const server = {
      server: {
        createMessage: async () => ({
          model: 'mock',
          role: 'assistant',
          content: { type: 'text', text: 'summary' },
        }),
      },
    };
    const summarize = await runSummarizeTool(server as never, {
      markdown: markdownWithFrontmatter,
    });

    for (const result of [pack, sections, extract, summarize]) {
      expect(frontmatterFromTextResult(result)).toEqual({
        title: 'Compact Docs',
        count: 3,
        enabled: true,
        tags: ['alpha', 'beta'],
        empty: null,
      });
      expect(textFromToolResult(result).length).toBeGreaterThan(0);
    }
  });

  test('text tools include empty frontmatter object when absent', async () => {
    const markdown = '# Intro\n\nBody\n';
    const pack = await runPackTool({ markdown });
    const sections = await runSectionsTool({ markdown });
    const extract = await runExtractTool({ markdown });

    for (const result of [pack, sections, extract]) {
      expect(frontmatterFromTextResult(result)).toEqual({});
    }
  });

  test('json tools include frontmatter key in payload', async () => {
    const stats = await runStatsTool({ markdown: markdownWithFrontmatter });
    const verify = await runVerifyTool({ markdown: markdownWithFrontmatter });

    const statsPayload = JSON.parse(textFromToolResult(stats)) as {
      frontmatter?: Record<string, unknown>;
    };
    const verifyPayload = JSON.parse(textFromToolResult(verify)) as {
      frontmatter?: Record<string, unknown>;
    };

    expect(statsPayload.frontmatter).toEqual({
      title: 'Compact Docs',
      count: 3,
      enabled: true,
      tags: ['alpha', 'beta'],
      empty: null,
    });
    expect(verifyPayload.frontmatter).toEqual({
      title: 'Compact Docs',
      count: 3,
      enabled: true,
      tags: ['alpha', 'beta'],
      empty: null,
    });
  });
});
