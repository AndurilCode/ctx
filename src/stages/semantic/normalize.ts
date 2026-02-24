import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { normalizeSmartPunctuation } from '../../utils/text.js';

export function normalizeTextTransform(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'text', (node) => {
    node.value = normalizeSmartPunctuation(node.value);
  });

  return tree;
}
