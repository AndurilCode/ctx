import type { List, ListItem, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

function markListItems(list: List, depth: number): void {
  for (const child of list.children) {
    if (child.type !== 'listItem') {
      continue;
    }

    const item = child as ListItem;
    if (!item.data) {
      item.data = {};
    }

    item.data.compactPrefix = list.ordered ? '+' : `${'..'.repeat(depth)}-`;
    item.data.compactDepth = depth;

    for (const grandChild of item.children) {
      if (grandChild.type === 'list') {
        markListItems(grandChild, depth + 1);
      }
    }
  }
}

export function transformLists(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'list', (node, _index, parent) => {
    if (parent?.type === 'listItem') {
      return;
    }

    markListItems(node as List, 0);
  });

  return tree;
}
