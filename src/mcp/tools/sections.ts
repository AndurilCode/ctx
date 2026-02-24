import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { astToMarkdown } from '../../parser/ast-to-markdown.js';
import { markdownToAst } from '../../parser/markdown-to-ast.js';
import { buildHeadingRanges } from '../../utils/headings.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { resolveMarkdown, textResult } from './common.js';

export interface SectionsToolInput {
  markdown?: string;
  file?: string;
}

export async function runSectionsTool(input: SectionsToolInput): Promise<CallToolResult> {
  const markdown = await resolveMarkdown(input);
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

  return textResult(lines.join('\n'));
}

export function registerSectionsTool(server: McpServer): void {
  server.registerTool(
    'compact_md_sections',
    {
      description:
        'List markdown sections with token costs. Pass either markdown (string) or file (absolute path).',
      inputSchema: {
        markdown: z.string().optional(),
        file: z.string().optional(),
      },
    },
    async (input) => runSectionsTool(input),
  );
}
