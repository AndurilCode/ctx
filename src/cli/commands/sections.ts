import { defineCommand } from 'citty';
import { astToMarkdown } from '../../parser/ast-to-markdown.js';
import { markdownToAst } from '../../parser/markdown-to-ast.js';
import { buildHeadingRanges } from '../../utils/headings.js';
import { createTokenCounter } from '../../utils/tokens.js';
import { readInput } from '../io.js';

export const sectionsCommand = defineCommand({
  meta: {
    name: 'sections',
    description: 'List sections in a markdown file with token costs.',
  },
  args: {
    input: {
      type: 'positional',
      required: true,
      description: 'Input markdown file path.',
    },
  },
  async run({ args }) {
    const markdown = await readInput(String(args.input));
    const tree = markdownToAst(markdown);
    const ranges = buildHeadingRanges(tree);
    const tokenCounter = await createTokenCounter();

    const lines: string[] = [];

    for (const range of ranges) {
      const sectionNodes = tree.children.slice(range.start, range.end);
      const sectionTree = { type: 'root' as const, children: sectionNodes };
      const sectionText = astToMarkdown(sectionTree);
      const tokens = tokenCounter.count(sectionText);

      const indent = '  '.repeat(range.depth - 1);
      const prefix = '#'.repeat(range.depth);
      lines.push(`${indent}${prefix} ${range.text}  (${tokens} tokens)`);
    }

    process.stdout.write(`${lines.join('\n')}\n`);
  },
});
