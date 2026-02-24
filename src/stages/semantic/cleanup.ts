import type { Content, Heading, Parent, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { stripTrailingHeadingHashes } from '../../utils/text.js';

function cleanHeadingText(node: Heading): void {
  const children = node.children;
  const lastChild = children[children.length - 1];
  if (!lastChild || lastChild.type !== 'text') {
    return;
  }

  lastChild.value = stripTrailingHeadingHashes(lastChild.value);
}

export function cleanupSemanticTransform(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'heading', (node) => {
    cleanHeadingText(node as Heading);
  });

  visit(tree, 'link', (node, index, parent) => {
    if (typeof index !== 'number' || !parent) {
      return;
    }

    if (typeof node.url === 'string' && node.url.trim() === '') {
      const replacement = [...(node as Parent).children] as Content[];
      (parent as Parent).children.splice(index, 1, ...replacement);
      return index;
    }
  });

  return tree;
}
