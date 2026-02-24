import { astToCompact } from '../parser/ast-to-compact.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import type { Stage } from '../stages/stage.js';
import type { CompactOptions } from '../types/options.js';
import { runPipeline } from './pipeline.js';

export interface PipelineRunner {
  run(markdown: string, options?: CompactOptions): string;
}

export function createPipeline(stages: readonly Stage[]): PipelineRunner {
  return {
    run(markdown: string, options: CompactOptions = {}): string {
      const tree = markdownToAst(markdown);
      const transformed = runPipeline(tree, stages, options);
      return astToCompact(transformed, options);
    },
  };
}
