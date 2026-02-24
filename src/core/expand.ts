import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { compactToAst } from '../parser/compact-to-ast.js';
import type { ExpandOptions } from '../types/options.js';
import { runPipeline } from './pipeline.js';

export function expand(compactText: string, options: ExpandOptions = {}): string {
  const tree = compactToAst(compactText, options);
  const transformed = runPipeline(tree, [], {});
  return astToMarkdown(transformed).trimEnd();
}
