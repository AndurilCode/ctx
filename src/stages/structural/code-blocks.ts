import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

export function transformCodeBlocks(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'code', (node) => {
    if (!node.data) {
      node.data = {};
    }

    node.data.compactCodeFence = true;
  });

  return tree;
}
