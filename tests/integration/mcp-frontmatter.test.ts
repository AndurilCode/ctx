import { describe, expect, test } from 'bun:test';
import { runExtractTool } from '../../src/mcp/tools/extract.js';
import { runPackTool } from '../../src/mcp/tools/pack.js';
import { runSectionsTool } from '../../src/mcp/tools/sections.js';

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

describe('mcp tools frontmatter', () => {
  test('text tools always include parsed frontmatter as second content item', async () => {
    const pack = await runPackTool({ markdown: markdownWithFrontmatter });
    const sections = await runSectionsTool({ markdown: markdownWithFrontmatter });
    const extract = await runExtractTool({ markdown: markdownWithFrontmatter });

    for (const result of [pack, sections, extract]) {
      expect(frontmatterFromTextResult(result)).toEqual({
        title: 'Compact Docs',
        count: 3,
        enabled: true,
        tags: ['alpha', 'beta'],
        empty: null,
      });
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
});
