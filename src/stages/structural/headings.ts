import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

export function transformHeadings(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'heading', (node) => {
    if (!node.data) {
      node.data = {};
    }

    node.data.compactHeading = `:${node.depth}`;
  });

  return tree;
}
