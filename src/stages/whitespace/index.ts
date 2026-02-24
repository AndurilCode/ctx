import type { Root } from 'mdast';
import type { CompactOptions } from '../../types/options.js';
import { createStage } from '../stage.js';
import { collapseBlankLinesStage } from './blank-lines.js';
import { stripTrailingStage } from './trailing.js';

function runWhitespaceTransforms(tree: Root, options: CompactOptions): Root {
  const withoutTrailing = stripTrailingStage(tree, options);
  return collapseBlankLinesStage(withoutTrailing, options);
}

export const whitespaceStage = createStage({
  name: 'whitespace',
  enabled: () => true,
  transform: runWhitespaceTransforms,
});
