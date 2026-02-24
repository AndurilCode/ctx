import type { Parent, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { stripTrailingWhitespace } from '../../utils/text.js';

export function stripTrailingStage(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'text', (node, index, parent) => {
    // Only strip trailing whitespace from the last child text node within its
    // parent. Intermediate text nodes between inline elements (bold, code, etc.)
    // carry significant word-boundary spaces that must be preserved.
    const isLastChild =
      parent !== null && index !== null && index === (parent as Parent).children.length - 1;
    if (!isLastChild) {
      return;
    }
    node.value = stripTrailingWhitespace(node.value);
  });

  return tree;
}
