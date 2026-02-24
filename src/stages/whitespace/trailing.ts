import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { stripTrailingWhitespace } from '../../utils/text.js';

export function stripTrailingStage(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'text', (node) => {
    node.value = stripTrailingWhitespace(node.value);
  });

  return tree;
}
