import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { ExtractOptions } from '../../types/options.js';
import { normalizeExtractLimit, truncateForExtract } from '../../utils/text.js';

const DEFAULT_MAX_CHARS = 200;

function resolveMaxChars(options: ExtractOptions): number {
  return normalizeExtractLimit(options.maxChars, DEFAULT_MAX_CHARS);
}

export function extractParagraphStage(tree: Root, options: ExtractOptions): Root {
  const maxChars = resolveMaxChars(options);

  visit(tree, 'paragraph', (node) => {
    let remaining = maxChars;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (!child) {
        continue;
      }
      if (child.type !== 'text') {
        continue;
      }

      const source = child.value;
      const { value, truncated } = truncateForExtract(source, remaining);
      child.value = value;

      if (truncated) {
        node.children = node.children.slice(0, index + 1);
        break;
      }

      remaining -= source.length;
    }
  });

  return tree;
}
