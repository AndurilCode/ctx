import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { DedupEntry } from './dictionary.js';

function replaceAll(input: string, from: string, to: string): string {
  if (!from) {
    return input;
  }
  return input.split(from).join(to);
}

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
