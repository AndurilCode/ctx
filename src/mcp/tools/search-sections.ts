import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { astToMarkdown } from '../../parser/ast-to-markdown.js';
import { markdownToAst } from '../../parser/markdown-to-ast.js';
import { buildHeadingRanges } from '../../utils/headings.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { textResult } from './common.js';

interface SearchSectionsToolInput {
  files: string[];
  query: string;
}

interface SectionMatch {
  file: string;
  section: string;
  depth: number;
  tokens: number;
}

export async function runSearchSectionsTool(
  input: SearchSectionsToolInput,
): Promise<CallToolResult> {
  const tokenCounter = await createTokenCounter();
  const normalizedQuery = input.query.toLowerCase();
  const matches: SectionMatch[] = [];

  for (const file of input.files) {
    let markdown: string;
    try {
      markdown = await readFile(file, 'utf-8');
    } catch {
      continue;
    }

    const tree = markdownToAst(markdown);
    const ranges = buildHeadingRanges(tree);

    for (const range of ranges) {
      if (!range.text.toLowerCase().includes(normalizedQuery)) continue;
      const sectionTree = {
        type: 'root' as const,
        children: tree.children.slice(range.start, range.end),
      };
      const tokens = tokenCounter.count(astToMarkdown(sectionTree));
      matches.push({ file, section: range.text, depth: range.depth, tokens });
    }
  }

  if (matches.length === 0) {
    return textResult(
      `No sections matching "${input.query}" found across ${input.files.length} file(s).`,
    );
  }

  let currentFile = '';
  const lines: string[] = [];
  for (const { file, section, depth, tokens } of matches) {
    if (file !== currentFile) {
      if (currentFile !== '') lines.push('');
      lines.push(file);
      currentFile = file;
    }
    const indent = '  '.repeat(depth - 1);
    lines.push(`${indent}${'#'.repeat(depth)} ${section}  (${tokens} tokens)`);
  }

  return textResult(lines.join('\n'));
}

export function registerSearchSectionsTool(server: McpServer): void {
  server.registerTool(
    'compact_md_search_sections',
    {
      description:
        'Search for sections matching a keyword across multiple files. Returns matching heading names with token counts, grouped by file. Use to find which files document a given topic (e.g. "oauth", "middleware", "testing") before deciding which to load — avoids running compact_md_sections on every file individually.',
      inputSchema: {
        files: z.array(z.string()),
        query: z.string(),
      },
    },
    async (input) => runSearchSectionsTool(input),
  );
}
