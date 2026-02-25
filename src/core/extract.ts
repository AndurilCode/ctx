import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import { elisionStage } from '../stages/elision/index.js';
import { extractStage } from '../stages/extract/index.js';
import type { CompactOptions, ExtractOptions } from '../types/options.js';
import { runPipeline } from './pipeline.js';

const EXTRACT_STAGES = [elisionStage, extractStage];

export function extract(markdown: string, options: ExtractOptions = {}): string {
  const tree = markdownToAst(markdown);
  const transformed = runPipeline(tree, EXTRACT_STAGES, options as CompactOptions);
  return astToMarkdown(transformed).trimEnd();
}
