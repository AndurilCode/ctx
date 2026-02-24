import type { Root } from 'mdast';
import type { CompactOptions } from '../types/options.js';

export interface Stage {
  readonly name: string;
  enabled(options: CompactOptions): boolean;
  transform(tree: Root, options: CompactOptions): Root;
}

export function createStage(config: Stage): Stage {
  return Object.freeze(config);
}
