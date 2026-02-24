import { astToCompact } from '../parser/ast-to-compact.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import { structuralStage } from '../stages/structural/index.js';
import { whitespaceStage } from '../stages/whitespace/index.js';
import type { CompactOptions } from '../types/options.js';
import type { CompactResult } from '../types/results.js';
import { computeStats } from '../utils/stats.js';
import { createFallbackTokenCounter } from '../utils/tokens.js';
import { runPipeline } from './pipeline.js';

export function compact(markdown: string, options: CompactOptions = {}): string | CompactResult {
  const tree = markdownToAst(markdown);
  const transformed = runPipeline(tree, [structuralStage, whitespaceStage], options);
  const output = astToCompact(transformed, options);

  if (!options.stats) {
    return output;
  }

  return {
    output,
    stats: computeStats(markdown, output, [], createFallbackTokenCounter()),
  };
}
