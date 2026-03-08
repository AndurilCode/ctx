import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import { buildHeadingRanges } from '../utils/headings.js';
import { createTokenCounter } from '../utils/tokens.js';

export interface LocateMatch {
  file: string;
  heading: string;
  depth: number;
  tokens: number;
}

export interface LocateEntry {
  file: string;
  markdown: string;
}

export async function locate(query: string, entries: LocateEntry[]): Promise<LocateMatch[]> {
  const counter = await createTokenCounter();
  const results: LocateMatch[] = [];
  const lowerQuery = query.toLowerCase();

  for (const { file, markdown } of entries) {
    const tree = markdownToAst(markdown);
    const ranges = buildHeadingRanges(tree);
    for (const range of ranges) {
      if (!range.text.toLowerCase().includes(lowerQuery)) continue;
      const sectionTree = {
        type: 'root' as const,
        children: tree.children.slice(range.start, range.end),
      };
      const tokens = counter.count(astToMarkdown(sectionTree));
      results.push({ file, heading: range.text, depth: range.depth, tokens });
    }
  }

  return results;
}
