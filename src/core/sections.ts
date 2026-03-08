import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import { parseFrontmatter } from '../utils/frontmatter.js';
import { buildHeadingRanges } from '../utils/headings.js';
import { createTokenCounter } from '../utils/tokens.js';

export interface SectionInfo {
  heading: string;
  depth: number;
  tokens: number;
}

export interface SectionsResult {
  frontmatter?: Record<string, unknown>;
  sections: SectionInfo[];
}

export async function sections(markdown: string): Promise<SectionsResult> {
  const frontmatter = parseFrontmatter(markdown);
  const tree = markdownToAst(markdown);
  const ranges = buildHeadingRanges(tree);
  const counter = await createTokenCounter();

  return {
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
    sections: ranges.map((range) => {
      const sectionNodes = tree.children.slice(range.start, range.end);
      const sectionTree = { type: 'root' as const, children: sectionNodes };
      const tokens = counter.count(astToMarkdown(sectionTree));
      return { heading: range.text, depth: range.depth, tokens };
    }),
  };
}
