import { astToCompact } from '../parser/ast-to-compact.js';
import { astToMarkdown } from '../parser/ast-to-markdown.js';
import { markdownToAst } from '../parser/markdown-to-ast.js';
import { unwrapStage } from '../stages/aggressive/unwrap.js';
import { dedupStage } from '../stages/dedup/index.js';
import { elisionStage } from '../stages/elision/index.js';
import { semanticStage } from '../stages/semantic/index.js';
import { whitespaceStage } from '../stages/whitespace/index.js';
import type { CompactOptions } from '../types/options.js';
import type { CompactResult } from '../types/results.js';
import { type StageMeasurement, computeStageStats, computeStats } from '../utils/stats.js';
import { createFallbackTokenCounter } from '../utils/tokens.js';
import { runPipeline } from './pipeline.js';

const PIPELINE_STAGES = [elisionStage, unwrapStage, whitespaceStage, semanticStage, dedupStage];

export function compact(markdown: string, options: CompactOptions = {}): CompactResult {
  const tree = markdownToAst(markdown);

  if (options.stats) {
    const measurements: StageMeasurement[] = [];
    let current = tree;
    for (const stage of PIPELINE_STAGES.filter((s) => s.enabled(options))) {
      const before = astToMarkdown(current);
      current = stage.transform(current, options);
      measurements.push({ stage: stage.name, before, after: astToMarkdown(current) });
    }
    const output = astToCompact(current, options);
    return {
      output,
      stats: computeStats(
        markdown,
        output,
        computeStageStats(measurements),
        createFallbackTokenCounter(),
      ),
    };
  }

  const transformed = runPipeline(tree, PIPELINE_STAGES, options);
  const output = astToCompact(transformed, options);
  return { output };
}
