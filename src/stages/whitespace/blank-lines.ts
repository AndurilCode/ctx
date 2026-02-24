import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { collapseBlankLines } from '../../utils/text.js';

export function collapseBlankLinesStage(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'text', (node) => {
    node.value = collapseBlankLines(node.value);
  });

  return tree;
}
