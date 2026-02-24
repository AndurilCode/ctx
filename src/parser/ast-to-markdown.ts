import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

const stringifier = unified()
  .use(remarkStringify, {
    bullet: '-',
    listItemIndent: 'one',
    fences: true,
    rule: '-',
  })
  .use(remarkGfm);

export function astToMarkdown(tree: Root): string {
  return stringifier.stringify(tree);
}
