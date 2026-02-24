import type { Root } from 'mdast';
import type { Stage } from '../stages/stage.js';
import type { CompactOptions } from '../types/options.js';

export function runPipeline(tree: Root, stages: readonly Stage[], options: CompactOptions): Root {
  return stages
    .filter((stage) => stage.enabled(options))
    .reduce((ast, stage) => stage.transform(ast, options), tree);
}
