import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { replaceAll } from '../../utils/text.js';
import type { DedupEntry } from './dictionary.js';

export function applyDedupReplacements(tree: Root, entries: readonly DedupEntry[]): Root {
  const ordered = [...entries].sort((a, b) => b.value.length - a.value.length);

  visit(tree, (node) => {
    if (node.type !== 'text' && node.type !== 'code' && node.type !== 'html') {
      return;
    }

    if (!('value' in node) || typeof node.value !== 'string') {
      return;
    }

    let nextValue = node.value;
    for (const entry of ordered) {
      nextValue = replaceAll(nextValue, entry.value, entry.token);
    }
    node.value = nextValue;
  });

  return tree;
}
