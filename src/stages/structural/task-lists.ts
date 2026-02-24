import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

export function transformTaskLists(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'listItem', (node) => {
    if (typeof node.checked !== 'boolean') {
      return;
    }

    if (!node.data) {
      node.data = {};
    }

    node.data.compactTask = true;
  });

  return tree;
}
