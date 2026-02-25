import type { ListItem, Paragraph, Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';
import type { ExtractOptions } from '../../types/options.js';
import { formatExtractOverflow, normalizeExtractLimit } from '../../utils/text.js';

const DEFAULT_MAX_LIST_ITEMS = 3;

function resolveMaxListItems(options: ExtractOptions): number {
  return normalizeExtractLimit(options.maxListItems, DEFAULT_MAX_LIST_ITEMS);
}

function createOverflowListItem(count: number): ListItem {
  const text: Text = {
    type: 'text',
    value: formatExtractOverflow('items', count),
  };
  const paragraph: Paragraph = {
    type: 'paragraph',
    children: [text],
  };

  return {
    type: 'listItem',
    spread: false,
    children: [paragraph],
  };
}

export function extractListStage(tree: Root, options: ExtractOptions): Root {
  const maxItems = resolveMaxListItems(options);

  visit(tree, 'list', (node) => {
    if (node.children.length <= maxItems) {
      return;
    }

    const hiddenCount = node.children.length - maxItems;
    node.children = [...node.children.slice(0, maxItems), createOverflowListItem(hiddenCount)];
  });

  return tree;
}
