import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CompactOptions } from '../../types/options.js';
import { unwrapSoftLineBreaks } from '../../utils/text.js';
import { createStage } from '../stage.js';

function runUnwrapTransform(tree: Root, _options: CompactOptions): Root {
  visit(tree, 'paragraph', (node) => {
    for (const child of node.children) {
      if (child.type !== 'text') {
        continue;
      }

      child.value = unwrapSoftLineBreaks(child.value);
    }
  });

  return tree;
}

export const unwrapStage = createStage({
  name: 'unwrap',
  enabled: (options) => options.unwrapLines === true,
  transform: runUnwrapTransform,
});
