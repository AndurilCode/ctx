import type { Parent, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';

function isHtmlComment(value: string): boolean {
  return /^<!--[\s\S]*-->$/.test(value.trim());
}

export function stripCommentsTransform(tree: Root, options: CompactOptions): Root {
  if (options.keepComments) {
    return tree;
  }

  visit(tree, 'html', (node, index, parent) => {
    if (typeof index !== 'number' || !parent || !isHtmlComment(node.value)) {
      return;
    }

    (parent as Parent).children.splice(index, 1);
    return index;
  });

  return tree;
}
