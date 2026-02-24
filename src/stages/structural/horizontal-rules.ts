import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

export function transformHorizontalRules(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'thematicBreak', (node) => {
    if (!node.data) {
      node.data = {};
    }

    node.data.compactThematicBreak = '~';
  });

  return tree;
}
