import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

export function transformTables(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'table', (node) => {
    if (!node.data) {
      node.data = {};
    }

    node.data.compactTable = true;
  });

  return tree;
}
