import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { astToMarkdown } from '../../parser/ast-to-markdown.js';
import { markdownToAst } from '../../parser/markdown-to-ast.js';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { buildHeadingRanges } from '../../utils/headings.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { resolveMarkdown, textResultWithFrontmatter } from './common.js';

export interface SectionsToolInput {
  markdown?: string;
  file?: string;
}

export async function runSectionsTool(input: SectionsToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
  const frontmatter = parseFrontmatter(markdown);
  const tree = markdownToAst(markdown);
  const ranges = buildHeadingRanges(tree);
  const tokenCounter = await createTokenCounter();

  const lines: string[] = [];
  for (const range of ranges) {
    const sectionNodes = tree.children.slice(range.start, range.end);
    const sectionTree = { type: 'root' as const, children: sectionNodes };
    const sectionText = astToMarkdown(sectionTree);
    const tokens = tokenCounter.count(sectionText);
    const indent = '  '.repeat(range.depth - 1);
    const prefix = '#'.repeat(range.depth);
    lines.push(`${indent}${prefix} ${range.text}  (${tokens} tokens)`);
  }

  return textResultWithFrontmatter(lines.join('\n'), frontmatter);
}

export function registerSectionsTool(server: McpServer): void {
  server.registerTool(
    'compact_md_sections',
    {
      description:
        'List markdown headings with per-section token costs. Use first to budget exploration; do not use for section text retrieval (use compact_md_extract).',
      inputSchema: {
        markdown: z.string().optional().describe('Markdown source text (Markdown-only).'),
        file: z.string().optional().describe('Path to a markdown file (.md/.mdx/.markdown).'),
      },
    },
    async (input) => runSectionsTool(input),
  );
}
