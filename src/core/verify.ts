import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import type { CompactOptions, ExpandOptions } from '../types/options.js';
import { compact } from './compact.js';
import { expand } from './expand.js';

function normalizeMarkdown(input: string): string {
  const ast = markdownToAst(input);
  return astToMarkdown(ast).trimEnd();
}

export function verify(
  markdown: string,
  compactOptions: CompactOptions = {},
  expandOptions: ExpandOptions = {},
): boolean {
  const compacted = compact(markdown, compactOptions);
  const compactText = compacted.output;
  const restored = expand(compactText, expandOptions);
  return normalizeMarkdown(markdown) === normalizeMarkdown(restored);
}
